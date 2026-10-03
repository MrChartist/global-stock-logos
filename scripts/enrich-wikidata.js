/**
 * enrich-wikidata.js — Official website, founding year, headquarters, CEO, aliases and employees from Wikidata.
 *
 * Matching (safest first):
 *   1. ISIN (Wikidata P946) — exact, no ticker clashes.
 *   2. Ticker (P249) AND company-name similarity >= 0.75.
 * Facts are only written when a match exists; anything else stays null (Needs verification).
 * Records older than --max-age-days (default 30) are refreshed, so a monthly run keeps data current.
 *
 *   node scripts/enrich-wikidata.js [--markets us,in] [--max-age-days 30] [--max-minutes 300]
 */
import fs from 'fs';
import path from 'path';
import { MARKETS } from './markets.js';
import { ROOT, loadShard, saveShard } from './enrich-store.js';

const UA = 'global-stock-logos/1.0 (https://github.com/MrChartist/global-stock-logos; contact@mrchartist.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const keys = opt('--markets') ? opt('--markets').split(',') : Object.keys(MARKETS);
const maxAge = parseInt(opt('--max-age-days', '30'), 10);
const deadline = Date.now() + parseInt(opt('--max-minutes', '300'), 10) * 60000;
const today = new Date().toISOString().slice(0, 10);
const stale = (d) => !d || (Date.parse(today) - Date.parse(d)) / 864e5 >= maxAge;

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'companies-metadata.json'), 'utf-8'));
const STOP = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|ag|sa|nv|se|spa|oyj|ab|asa|llc|lp|holdings?|group|the|class|shs|ordinary|adr|ads|pcl|bhd|tbk|pvt|public)\b/g;
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim();
const similar = (a, b) => {
    const A = new Set(norm(a).split(' ').filter(Boolean)), B = new Set(norm(b).split(' ').filter(Boolean));
    if (!A.size || !B.size) return 0;
    let h = 0; for (const w of A) if (B.has(w)) h++;
    return h / Math.max(A.size, B.size);
};

async function sparql(q) {
    for (let a = 0; a < 5; a++) {
        if (Date.now() > deadline) return null;
        try {
            const res = await fetch('https://query.wikidata.org/sparql', {
                method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'format=json&query=' + encodeURIComponent(q), signal: AbortSignal.timeout(90000),
            });
            if (res.ok) return (await res.json()).results.bindings;
            await sleep(res.status === 429 ? 15000 : 4000 * (a + 1));
        } catch { await sleep(4000 * (a + 1)); }
    }
    return null;
}
const qid = (u) => u.split('/').pop();
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/** Step 1: ISIN / ticker -> Wikidata item ids. */
async function findItems(todo) {
    const found = new Map(); // `${market}:${sym}` -> qid
    const byIsin = todo.filter((t) => t.isin);
    for (const c of chunks(byIsin, 250)) {
        const rows = await sparql(`SELECT ?isin ?i WHERE { VALUES ?isin { ${c.map((t) => `"${t.isin}"`).join(' ')} } ?i wdt:P946 ?isin. }`);
        if (!rows) return found;
        const m = new Map(); for (const r of rows) m.set(r.isin.value, qid(r.i.value));
        for (const t of c) if (m.has(t.isin)) found.set(t.id, { q: m.get(t.isin), how: 'isin' });
        await sleep(800);
    }
    const rest = todo.filter((t) => !found.has(t.id));
    for (const c of chunks(rest, 80)) {
        const syms = [...new Set(c.map((t) => t.sym))];
        const rows = await sparql(`SELECT ?t ?i ?l WHERE { VALUES ?t { ${syms.map((s) => `"${s.replace(/"/g, '')}"`).join(' ')} }
          { ?i p:P414 ?s. ?s pq:P249 ?t. } UNION { ?i wdt:P249 ?t. } ?i rdfs:label ?l. FILTER(LANG(?l)="en") }`);
        if (!rows) return found;
        for (const t of c) {
            const hit = rows.find((r) => r.t.value === t.sym && similar(t.company, r.l.value) >= 0.75);
            if (hit) found.set(t.id, { q: qid(hit.i.value), how: 'ticker+name' });
        }
        await sleep(800);
    }
    return found;
}

/** Step 2: facts for unique items. */
async function getFacts(qids) {
    const facts = new Map();
    for (const c of chunks(qids, 120)) {
        const rows = await sparql(`SELECT ?i
          (SAMPLE(?web) AS ?website) (MIN(YEAR(?inc)) AS ?founded)
          (SAMPLE(?hql) AS ?hq) (GROUP_CONCAT(DISTINCT ?ceol; separator=" / ") AS ?ceo) (MAX(?emp) AS ?employees)
          (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?aliases) WHERE {
          VALUES ?i { ${c.map((q) => `wd:${q}`).join(' ')} }
          OPTIONAL { ?i wdt:P856 ?web } OPTIONAL { ?i wdt:P571 ?inc } OPTIONAL { ?i wdt:P1128 ?emp }
          OPTIONAL { ?i wdt:P159 ?hqi. ?hqi rdfs:label ?hql. FILTER(LANG(?hql)="en") }
          OPTIONAL { ?i p:P169 ?cst. ?cst ps:P169 ?ceoi. FILTER NOT EXISTS { ?cst pq:P582 ?cend }
            ?ceoi rdfs:label ?ceol. FILTER(LANG(?ceol)="en") }
          OPTIONAL { ?i skos:altLabel ?alt. FILTER(LANG(?alt)="en") }
        } GROUP BY ?i`);
        if (!rows) return facts;
        for (const r of rows) facts.set(qid(r.i.value), {
            website: r.website?.value || null,
            founded: r.founded && +r.founded.value > 0 ? +r.founded.value : null,
            headquarters: r.hq?.value || null, ceo: r.ceo?.value ? r.ceo.value.split(' / ').slice(0, 2).join(' / ') : null,
            employees: r.employees ? Math.round(+r.employees.value) : null,
            aliases: (r.aliases?.value || '').split('|').filter(Boolean).slice(0, 8),
        });
        await sleep(800);
    }
    return facts;
}

for (const key of keys) {
    if (!MARKETS[key]) continue;
    if (Date.now() > deadline) { console.log('Time budget reached; rerun to continue (resumable).'); break; }
    const shard = loadShard(key);
    const todo = Object.entries(shard)
        .filter(([, v]) => stale(v.wikidataAt))
        .map(([sym, v]) => ({ id: `${key}:${sym}`, sym, isin: v.isin, company: meta[`${key.toUpperCase()}:${sym}`]?.company || sym }));
    if (!todo.length) { console.log(`[${key}] up to date`); continue; }
    const items = await findItems(todo);
    const facts = await getFacts([...new Set([...items.values()].map((v) => v.q))]);
    let matched = 0;
    for (const t of todo) {
        const it = items.get(t.id);
        const rec = shard[t.sym];
        if (it && facts.has(it.q)) {
            const f = facts.get(it.q); matched++;
            Object.assign(rec, {
                wikidata: it.q, wikidataMatch: it.how, website: f.website, founded: f.founded,
                headquarters: f.headquarters, ceo: f.ceo, aliases: f.aliases,
                employees: rec.employees ?? f.employees,
            });
        }
        rec.wikidataAt = today; // checked today, even when no match, so the next run skips it until it is stale
    }
    saveShard(key, shard);
    console.log(`[${key}] todo=${todo.length} matched=${matched}`);
}
console.log('Done.');
