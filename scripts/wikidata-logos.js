/**
 * wikidata-logos.js — Fill companies that TradingView has no logo for, using Wikidata (P154 "logo image")
 * and Wikimedia Commons. Strict matching: ticker must match AND company names must agree.
 * Only SVG logos are accepted. Every file's source is recorded in logo-sources.json for licence traceability.
 *
 *   node scripts/wikidata-logos.js [--markets in,us] [--limit 200]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MARKETS } from './markets.js';
import { hasVisibleArt, namespaceIds } from './svg-quality.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGOS = path.join(ROOT, 'logos');
const META = path.join(ROOT, 'companies-metadata.json');
const SOURCES = path.join(ROOT, 'logo-sources.json');
const UA = 'global-stock-logos/1.0 (https://github.com/MrChartist/global-stock-logos; contact@mrchartist.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const keys = opt('--markets') ? opt('--markets').split(',') : Object.keys(MARKETS);
const limit = opt('--limit') ? parseInt(opt('--limit'), 10) : Infinity;

const STOP = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|ag|sa|nv|se|spa|oyj|ab|asa|llc|lp|holdings?|group|the|class|shs|ordinary|adr|ads|pcl|bhd|tbk|pvt|public)\b/g;
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim();
const similar = (a, b) => {
    const A = new Set(norm(a).split(' ').filter(Boolean)), B = new Set(norm(b).split(' ').filter(Boolean));
    if (!A.size || !B.size) return 0;
    let hit = 0; for (const w of A) if (B.has(w)) hit++;
    return hit / Math.max(A.size, B.size);
};

async function getJson(url, init = {}) {
    for (let a = 0; a < 5; a++) {
        try {
            const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(60000) });
            if (res.ok) return await res.json();
            if (res.status === 429 || res.status >= 500) await sleep(3000 * (a + 1)); else return null;
        } catch { await sleep(2000 * (a + 1)); }
    }
    return null;
}

async function missingCompanies(key, cfg, have) {
    const out = [];
    for (let start = 0; ; start += 5000) {
        const j = await getJson(`https://scanner.tradingview.com/${cfg.scanner}/scan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filter: [{ left: 'type', operation: 'in_range', right: ['stock', 'dr'] }],
                columns: ['name', 'description', 'logoid', 'market_cap_basic'],
                sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' }, range: [start, start + 5000],
            }),
        });
        const rows = j?.data || [];
        for (const { d: [name, desc, logoid, mcap] } of rows) {
            if (logoid || !name) continue;
            const sym = name.toUpperCase().trim().replace(/[^A-Z0-9_.-]/g, '');
            if (sym && !have.has(sym) && !out.some((o) => o.sym === sym)) out.push({ sym, desc, mcap });
        }
        if (rows.length < 5000) break;
    }
    return out;
}

async function wikidataBatch(tickers) {
    const values = tickers.map((t) => `"${t.replace(/"/g, '')}"`).join(' ');
    const q = `SELECT ?item ?itemLabel ?t ?logo WHERE {
      VALUES ?t { ${values} }
      { ?item p:P414 ?s. ?s pq:P249 ?t. } UNION { ?item wdt:P249 ?t. }
      ?item wdt:P154 ?logo.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
    const j = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, { headers: { Accept: 'application/sparql-results+json' } });
    return j?.results?.bindings || [];
}

async function downloadSvg(fileUrl) {
    const name = decodeURIComponent(fileUrl.split('/').pop());
    if (!/\.svg$/i.test(name)) return null;
    for (let a = 0; a < 3; a++) {
        try {
            const res = await fetch(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000), redirect: 'follow' });
            if (res.ok) {
                const t = await res.text();
                if (!t.includes('<svg') || /<script|<foreignObject|xlink:href="https?:|href="https?:/i.test(t)) return null;
                return hasVisibleArt(t) ? { svg: namespaceIds(t), name } : null;
            }
            if (res.status === 429) await sleep(5000 * (a + 1)); else return null;
        } catch { await sleep(2000); }
    }
    return null;
}

const meta = JSON.parse(fs.readFileSync(META, 'utf-8'));
const sources = fs.existsSync(SOURCES) ? JSON.parse(fs.readFileSync(SOURCES, 'utf-8')) : {};
let added = 0, tried = 0;

for (const key of keys) {
    const cfg = MARKETS[key]; if (!cfg) continue;
    const dir = path.join(LOGOS, key); fs.mkdirSync(dir, { recursive: true });
    const have = new Set(fs.readdirSync(dir).map((f) => f.replace(/\.(svg|png)$/, '')));
    const todo = (await missingCompanies(key, cfg, have)).slice(0, Math.max(0, limit - tried));
    tried += todo.length;
    let got = 0;
    for (let i = 0; i < todo.length; i += 60) {
        const chunk = todo.slice(i, i + 60);
        const rows = await wikidataBatch([...new Set(chunk.map((c) => c.sym))]);
        for (const c of chunk) {
            const cands = rows.filter((r) => r.t.value === c.sym && similar(c.desc, r.itemLabel.value) >= 0.75);
            for (const r of cands) {
                const dl = await downloadSvg(r.logo.value);
                await sleep(300);
                if (!dl) continue;
                fs.writeFileSync(path.join(dir, `${c.sym}.svg`), dl.svg);
                const mk = `${key.toUpperCase()}:${c.sym}`;
                meta[mk] = {
                    symbol: c.sym, company: c.desc || c.sym, country: cfg.country, market: key.toUpperCase(),
                    sector: null, industry: null, marketCap: c.mcap || null, logoid: null,
                    yahooTicker: `${c.sym}${cfg.suffix}`, yahooUrl: `https://finance.yahoo.com/quote/${c.sym}${cfg.suffix}`,
                };
                sources[mk] = { wikidata: r.item.value, commonsFile: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(dl.name)}`, matchedName: r.itemLabel.value };
                got++; added++;
                break;
            }
        }
        await sleep(1000);
    }
    console.log(`[${key}] missing=${todo.length} filledFromWikidata=${got}`);
    fs.writeFileSync(META, JSON.stringify(meta, null, 2));
    fs.writeFileSync(SOURCES, JSON.stringify(sources, null, 2));
}
console.log(`Done. ${added} logos added from Wikidata/Commons (tried ${tried}).`);
