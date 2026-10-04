/**
 * refresh-metadata.js — Monthly refresh of market data for every logo in the catalog.
 * Source: TradingView scanner (one request page covers thousands of companies).
 * Updates companies-metadata.json (company, sector, industry, marketCap) and
 * enrichment/<market>.json (currency, exchange, isin, employees, country, flag, marketDataAt).
 *
 *   node scripts/refresh-metadata.js [--markets us,in]
 */
import fs from 'fs';
import path from 'path';
import { MARKETS } from './markets.js';
import { ROOT, loadShard, saveShard, flag, iso2 } from './enrich-store.js';

const META = path.join(ROOT, 'companies-metadata.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const COLS = ['name', 'description', 'sector', 'industry', 'market_cap_basic', 'currency', 'country', 'exchange', 'isin', 'number_of_employees', 'type', 'fundamental_currency_code'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const keys = args.includes('--markets') ? args[args.indexOf('--markets') + 1].split(',') : Object.keys(MARKETS);
const now = new Date().toISOString().slice(0, 10);

async function page(region, start) {
    for (let a = 0; a < 4; a++) {
        try {
            const res = await fetch(`https://scanner.tradingview.com/${region}/scan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
                body: JSON.stringify({
                    filter: [{ left: 'type', operation: 'in_range', right: ['stock', 'dr'] }], columns: COLS,
                    sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' }, range: [start, start + 5000],
                }),
                signal: AbortSignal.timeout(90000),
            });
            if (res.ok) return (await res.json()).data || [];
        } catch {}
        await sleep(2000 * (a + 1));
    }
    return null;
}

// Exchange rates (USD base, free open.er-api.com). Kept in fx-rates.json so a failed download falls back to the last good one.
const FX_FILE = path.join(ROOT, 'fx-rates.json');
let fx = fs.existsSync(FX_FILE) ? JSON.parse(fs.readFileSync(FX_FILE, 'utf-8')) : { rates: {} };
try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(30000) });
    const j = r.ok ? await r.json() : null;
    if (j?.result === 'success') { fx = { date: now, source: 'open.er-api.com', rates: j.rates }; fs.writeFileSync(FX_FILE, JSON.stringify(fx)); }
} catch {}
if (!Object.keys(fx.rates).length) console.warn('No exchange rates available: marketCapUsd will be left empty');
const meta = JSON.parse(fs.readFileSync(META, 'utf-8'));
for (const key of keys) {
    const cfg = MARKETS[key]; if (!cfg) continue;
    const shard = loadShard(key);
    const dir = path.join(ROOT, 'logos', key);
    const have = new Set(fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => f.replace(/\.(svg|png)$/, '')) : []);
    let rows = [], ok = true;
    for (let s = 0; ; s += 5000) {
        const p = await page(cfg.scanner, s);
        if (p === null) { ok = false; break; }
        rows.push(...p);
        if (p.length < 5000) break;
    }
    if (!ok) { console.warn(`[${key}] scan failed, keeping previous data`); continue; }
    const done = new Set(); let n = 0;
    for (const { d: [name, desc, sector, industry, mcap, currency, country, exchange, isin, employees, type, capCurrency] } of rows) {
        const sym = String(name || '').toUpperCase().trim().replace(/[^A-Z0-9_.-]/g, '');
        if (!sym || !have.has(sym) || done.has(sym)) continue;
        done.add(sym); n++;
        const mk = `${key.toUpperCase()}:${sym}`;
        if (meta[mk]) {
            if (desc) meta[mk].company = desc;
            meta[mk].sector = sector || meta[mk].sector || null;
            meta[mk].industry = industry || meta[mk].industry || null;
            meta[mk].marketCap = mcap || null;
        }
        shard[sym] = {
            ...(shard[sym] || {}),
            currency: currency || null, exchange: exchange || null, isin: isin || null,
            employees: Number.isInteger(employees) && employees > 0 ? employees : null, // fractional values are not head-counts type: type || null,
            country: country || cfg.country, countryCode: iso2(country || cfg.country), flag: flag(country || cfg.country),
            capCurrency: capCurrency || null,
            marketCapUsd: mcap && fx.rates[capCurrency] ? Math.round(mcap / fx.rates[capCurrency]) : null,
            marketDataAt: now,
        };
    }
    // Logos whose company is no longer in the scan (delisted, renamed): mark as checked so they are not retried forever.
    for (const sym of have) {
        if (done.has(sym)) { if (shard[sym]) delete shard[sym].notInScan; continue; }
        shard[sym] = { ...(shard[sym] || {}), marketDataAt: now, notInScan: true };
    }
    saveShard(key, shard);
    console.log(`[${key}] refreshed ${n} of ${have.size} logos`);
}
fs.writeFileSync(META, JSON.stringify(meta, null, 2));
console.log('Done.');
