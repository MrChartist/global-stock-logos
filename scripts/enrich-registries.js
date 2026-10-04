/**
 * enrich-registries.js — Fill gaps that Wikidata left, from official open registries.
 *   - GLEIF (global legal-entity registry, by ISIN): headquarters city and country, LEI, legal name.
 *   - SEC EDGAR (US filers, by ticker + name check): headquarters city/state, website when filed, CIK.
 * Only EMPTY fields are filled; Wikidata and hand-curated values are never overwritten.
 * Each filled field is recorded in `sources`. Resumable and time-boxed; records are rechecked after --max-age-days.
 *
 *   node scripts/enrich-registries.js [--markets us,in] [--max-age-days 30] [--max-minutes 120]
 */
import { MARKETS } from './markets.js';
import fs from 'fs';
import path from 'path';
import { ROOT, loadShard, saveShard, similar } from './enrich-store.js';

const UA = 'global-stock-logos/1.0 (https://github.com/MrChartist/global-stock-logos; contact@mrchartist.com)';
// SEC requires a plain "Name contact-email" user agent.
const SEC_UA = 'MrChartist global-stock-logos contact@mrchartist.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const keys = opt('--markets') ? opt('--markets').split(',') : Object.keys(MARKETS);
const maxAge = parseInt(opt('--max-age-days', '30'), 10);
const deadline = Date.now() + parseInt(opt('--max-minutes', '120'), 10) * 60000;
const today = new Date().toISOString().slice(0, 10);
const stale = (d) => !d || (Date.parse(today) - Date.parse(d)) / 864e5 >= maxAge;
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'companies-metadata.json'), 'utf-8'));
const title = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

async function getJson(url) {
    for (let a = 0; a < 4; a++) {
        if (Date.now() > deadline) return undefined;
        try {
            const res = await fetch(url, { headers: { 'User-Agent': url.includes('sec.gov') ? SEC_UA : UA, Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
            if (res.ok) return await res.json();
            if (res.status === 404) return null;
            await sleep(res.status === 429 ? 20000 : 3000 * (a + 1));
        } catch { await sleep(3000 * (a + 1)); }
    }
    return undefined;
}
const setIfEmpty = (rec, field, value, source) => {
    if (value == null || value === '' || rec[field]) return false;
    rec[field] = value; (rec.sources ||= {})[field] = source; return true;
};

// SEC ticker -> { cik, title } (US only)
let secMap = null;
async function secTickers() {
    if (secMap) return secMap;
    const j = await getJson('https://www.sec.gov/files/company_tickers.json');
    secMap = new Map(Object.values(j || {}).map((v) => [String(v.ticker).toUpperCase(), { cik: String(v.cik_str).padStart(10, '0'), title: v.title }]));
    return secMap;
}

for (const key of keys) {
    if (!MARKETS[key] || Date.now() > deadline) continue;
    const shard = loadShard(key);
    let gleif = 0, sec = 0, gtried = 0, stried = 0;

    // --- GLEIF, batched by ISIN
    const g = Object.entries(shard).filter(([, v]) => v.isin && stale(v.gleifAt));
    for (let i = 0; i < g.length && Date.now() < deadline; i += 100) {
        const batch = g.slice(i, i + 100);
        const j = await getJson(`https://api.gleif.org/api/v1/lei-records?filter%5Bisin%5D=${batch.map(([, v]) => v.isin).join(',')}&page%5Bsize%5D=200`);
        if (j === undefined) break;
        // The API does not echo which ISIN matched, so confirm by legal-name similarity with our company name.
        const recs = (j?.data || []).map((r) => ({ lei: r.attributes.lei, name: r.attributes.entity.legalName?.name, hq: r.attributes.entity.headquartersAddress, st: r.attributes.entity.status }));
        for (const [sym, rec] of batch) {
            const company = meta[`${key.toUpperCase()}:${sym}`]?.company || sym;
            const hit = recs.filter((r) => r.st === 'ACTIVE').map((r) => ({ r, s: similar(company, r.name) })).sort((a, b) => b.s - a.s)[0];
            rec.gleifAt = today; gtried++;
            if (hit && hit.s >= 0.6) {
                const hq = [title(hit.r.hq?.city), hit.r.hq?.country].filter(Boolean).join(', ');
                let n = 0;
                n += setIfEmpty(rec, 'headquarters', hq, 'gleif');
                n += setIfEmpty(rec, 'lei', hit.r.lei, 'gleif');
                n += setIfEmpty(rec, 'legalName', hit.r.name, 'gleif');
                if (n) gleif++;
            }
        }
        saveShard(key, shard);
        await sleep(1200);
    }

    // --- SEC EDGAR for the US shard
    if (key === 'us') {
        const map = await secTickers();
        const s = Object.entries(shard).filter(([sym, v]) => map.has(sym) && (!v.headquarters || !v.website) && stale(v.secAt));
        for (const [sym, rec] of s) {
            if (Date.now() > deadline) break;
            const m = map.get(sym);
            const company = meta[`US:${sym}`]?.company || sym;
            rec.secAt = today; stried++;
            if (similar(company, m.title) < 0.6) continue;
            const j = await getJson(`https://data.sec.gov/submissions/CIK${m.cik}.json`);
            if (j === undefined) break;
            if (!j) continue;
            const a = j.addresses?.business;
            const hq = a?.city ? [title(a.city), a.stateOrCountryDescription || a.stateOrCountry].filter(Boolean).join(', ') : null;
            let n = 0;
            n += setIfEmpty(rec, 'headquarters', hq, 'sec-edgar');
            n += setIfEmpty(rec, 'website', j.website ? (/^https?:/.test(j.website) ? j.website : `https://${j.website}`) : null, 'sec-edgar');
            n += setIfEmpty(rec, 'cik', m.cik, 'sec-edgar');
            if (n) sec++;
            await sleep(150);
        }
        saveShard(key, shard);
    }
    saveShard(key, shard);
    console.log(`[${key}] gleif tried=${gtried} filled=${gleif}` + (key === 'us' ? ` | sec tried=${stried} filled=${sec}` : ''));
}
console.log('Done.');
