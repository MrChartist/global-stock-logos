/**
 * enrich-by-name.js — Third pass for companies that ISIN/ticker matching could not identify.
 * Works from the largest companies (market cap) downwards, so the most valuable gaps close first.
 *
 *   GLEIF   : search by legal name restricted to the company's country; accept only a very close name (>= 0.85).
 *   Wikidata: search by name; a candidate is accepted only if it is a business (P31/P279* of Q4830453),
 *             its country matches ours, and its name is a very close match (>= 0.85).
 * Only EMPTY fields are filled; every filled field records its source. Resumable (`nameAt`) and time-boxed.
 *
 *   node scripts/enrich-by-name.js [--markets in,taiwan] [--max-minutes 90] [--max-age-days 30] [--limit 5000]
 */
import fs from 'fs';
import path from 'path';
import { MARKETS } from './markets.js';
import { ROOT, loadShard, saveShard, similar } from './enrich-store.js';

const UA = 'global-stock-logos/1.0 (https://github.com/MrChartist/global-stock-logos; contact@mrchartist.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const keys = opt('--markets') ? opt('--markets').split(',') : Object.keys(MARKETS);
const maxAge = parseInt(opt('--max-age-days', '30'), 10);
const limit = parseInt(opt('--limit', '1000000'), 10);
const deadline = Date.now() + parseInt(opt('--max-minutes', '90'), 10) * 60000;
const today = new Date().toISOString().slice(0, 10);
const stale = (d) => !d || (Date.parse(today) - Date.parse(d)) / 864e5 >= maxAge;
const MIN_SIM = 0.85;
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'companies-metadata.json'), 'utf-8'));
const title = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

async function getJson(url, init = {}) {
    for (let a = 0; a < 4; a++) {
        if (Date.now() > deadline) return undefined;
        try {
            const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(60000) });
            if (res.ok) return await res.json();
            if (res.status === 404) return null;
            await sleep(res.status === 429 ? 20000 : 3000 * (a + 1));
        } catch { await sleep(3000 * (a + 1)); }
    }
    return undefined;
}
const setIfEmpty = (rec, field, value, source) => {
    if (value == null || value === '' || (Array.isArray(value) && !value.length) || rec[field]) return false;
    rec[field] = value; (rec.sources ||= {})[field] = source; return true;
};
const qid = (u) => u.split('/').pop();

async function gleifByName(company, cc) {
    const j = await getJson(`https://api.gleif.org/api/v1/lei-records?filter%5Bentity.legalName%5D=${encodeURIComponent(company)}&filter%5Bentity.legalAddress.country%5D=${cc}&page%5Bsize%5D=5`);
    if (!j) return null;
    return (j.data || []).filter((r) => r.attributes.entity.status === 'ACTIVE')
        .map((r) => ({ lei: r.attributes.lei, name: r.attributes.entity.legalName?.name, hq: r.attributes.entity.headquartersAddress, s: similar(company, r.attributes.entity.legalName?.name) }))
        .sort((a, b) => b.s - a.s)[0] || null;
}

/** Wikidata candidates for a name, verified as a business in the right country, with facts. */
async function wikidataByName(company, cc) {
    const sr = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(company)}&language=en&type=item&limit=6&format=json`);
    const cands = (sr?.search || []).map((x) => ({ q: x.id, s: similar(company, x.label || '') })).filter((x) => x.s >= MIN_SIM).sort((a, b) => b.s - a.s);
    if (!cands.length) return null;
    const rows = await sparqlFacts(cands.map((c) => c.q), cc);
    if (!rows) return null;
    for (const c of cands) { const r = rows.get(c.q); if (r) return { q: c.q, ...r }; }
    return null;
}
async function sparqlFacts(qids, cc) {
    const q = `SELECT ?i (SAMPLE(?web) AS ?website) (MIN(YEAR(?inc)) AS ?founded) (SAMPLE(?hql) AS ?hq)
      (GROUP_CONCAT(DISTINCT ?ceol; separator=" / ") AS ?ceo) (MAX(?emp) AS ?employees) (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?aliases) WHERE {
      VALUES ?i { ${qids.map((x) => `wd:${x}`).join(' ')} }
      ?i wdt:P31/wdt:P279* wd:Q4830453.
      { ?i wdt:P17 ?c. ?c wdt:P297 "${cc}". } UNION { ?i wdt:P159/wdt:P17 ?c2. ?c2 wdt:P297 "${cc}". }
      OPTIONAL { ?i wdt:P856 ?web } OPTIONAL { ?i wdt:P571 ?inc } OPTIONAL { ?i wdt:P1128 ?emp }
      OPTIONAL { ?i wdt:P159 ?hqi. ?hqi rdfs:label ?hql. FILTER(LANG(?hql)="en") }
      OPTIONAL { ?i p:P169 ?cst. ?cst ps:P169 ?ceoi. FILTER NOT EXISTS { ?cst pq:P582 ?cend } ?ceoi rdfs:label ?ceol. FILTER(LANG(?ceol)="en") }
      OPTIONAL { ?i skos:altLabel ?alt. FILTER(LANG(?alt)="en") }
    } GROUP BY ?i`;
    const j = await getJson('https://query.wikidata.org/sparql', { method: 'POST', headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'format=json&query=' + encodeURIComponent(q) });
    if (!j) return null;
    const out = new Map();
    for (const r of j.results.bindings) out.set(qid(r.i.value), {
        website: r.website?.value || null, founded: r.founded && +r.founded.value > 0 ? +r.founded.value : null,
        headquarters: r.hq?.value || null, ceo: r.ceo?.value ? r.ceo.value.split(' / ').slice(0, 2).join(' / ') : null,
        employees: r.employees ? Math.round(+r.employees.value) : null, aliases: (r.aliases?.value || '').split('|').filter(Boolean).slice(0, 8),
    });
    return out;
}

// Work list: unmatched or headquarters-less companies, biggest first.
const shards = {};
const work = [];
for (const key of keys) {
    if (!MARKETS[key]) continue;
    shards[key] = loadShard(key);
    for (const [sym, rec] of Object.entries(shards[key])) {
        const m = meta[`${key.toUpperCase()}:${sym}`];
        if (!m?.marketCap || !rec.countryCode || !stale(rec.nameAt)) continue;
        if (rec.wikidata && rec.headquarters) continue;
        work.push({ key, sym, rec, company: m.company, cap: m.marketCap });
    }
}
work.sort((a, b) => b.cap - a.cap);
// Adaptive: stop querying GLEIF for a country where it clearly does not cover listed companies (hit rate under 2% after 40 tries).
const gstat = {};
const gleifWorthIt = (cc) => { const g = gstat[cc]; return !g || g.tried < 40 || g.hit / g.tried >= 0.02; };
const touched = new Set();
let done = 0, gl = 0, wd = 0;
const flush = () => { for (const k of touched) saveShard(k, shards[k]); touched.clear(); };

for (const w of work.slice(0, limit)) {
    if (Date.now() > deadline) break;
    const { rec, company } = w;
    if ((!rec.headquarters || !rec.lei) && gleifWorthIt(rec.countryCode)) {
        const g = await gleifByName(company, rec.countryCode);
        const st = (gstat[rec.countryCode] ||= { tried: 0, hit: 0 }); st.tried++;
        if (g === undefined) break;
        if (g && g.s >= MIN_SIM) {
            st.hit++;
            let n = 0;
            n += setIfEmpty(rec, 'headquarters', [title(g.hq?.city), g.hq?.country].filter(Boolean).join(', '), 'gleif-name');
            n += setIfEmpty(rec, 'lei', g.lei, 'gleif-name');
            n += setIfEmpty(rec, 'legalName', g.name, 'gleif-name');
            if (n) gl++;
        }
        await sleep(1100);
    }
    if (!rec.wikidata) {
        const f = await wikidataByName(company, rec.countryCode);
        if (f) {
            let n = 0;
            for (const field of ['website', 'founded', 'headquarters', 'ceo', 'aliases', 'employees']) n += setIfEmpty(rec, field, f[field], 'wikidata-name');
            rec.wikidata = f.q; rec.wikidataMatch = 'name+country';
            if (n) wd++;
        }
        await sleep(400);
    }
    rec.nameAt = today; touched.add(w.key); done++;
    if (done % 50 === 0) { flush(); console.log(`progress ${done}/${work.length} gleifFilled=${gl} wikidataFilled=${wd}`); }
}
flush();
console.log(`Done. processed=${done} of ${work.length} pending; GLEIF filled ${gl}, Wikidata filled ${wd}.`);
