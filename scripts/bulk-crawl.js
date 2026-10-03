/**
 * bulk-crawl.js — Bulk ingestion of REAL company logos for every market in markets.js.
 *
 * Only logos that TradingView actually serves are saved. Companies without a real logo
 * are skipped (no generated placeholder badges). Resumable: existing files are never refetched.
 *
 * Usage:
 *   node scripts/bulk-crawl.js                         # all markets
 *   node scripts/bulk-crawl.js --markets korea,china   # selected markets
 *   node scripts/bulk-crawl.js --limit 500             # cap new logos per market
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MARKETS } from './markets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGOS_DIR = path.join(ROOT, 'logos');
const META_FILE = path.join(ROOT, 'companies-metadata.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const PAGE = 5000;
const CONCURRENCY = 24;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scan(region, start) {
    const body = {
        filter: [{ left: 'type', operation: 'in_range', right: ['stock', 'dr'] }],
        columns: ['name', 'description', 'logoid', 'sector', 'industry', 'market_cap_basic', 'exchange'],
        sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
        range: [start, start + PAGE],
    };
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(`https://scanner.tradingview.com/${region}/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(60000),
            });
            if (res.ok) return await res.json();
        } catch {}
        await sleep(2000 * (attempt + 1));
    }
    return { totalCount: 0, data: [] };
}

async function fetchSvg(logoid) {
    for (const url of [
        `https://s3-symbol-logo.tradingview.com/${logoid}--big.svg`,
        `https://s3-symbol-logo.tradingview.com/${logoid}.svg`,
    ]) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
                if (res.status === 404) break;
                if (res.ok) {
                    const t = await res.text();
                    if (t.includes('<svg') && t.includes('</svg>')) return t;
                    break;
                }
            } catch {}
            await sleep(500);
        }
    }
    return null;
}

async function pool(items, worker) {
    let i = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (i < items.length) await worker(items[i++]);
    }));
}

async function crawlMarket(key, cfg, meta, limit) {
    const dir = path.join(LOGOS_DIR, key);
    fs.mkdirSync(dir, { recursive: true });

    const rows = [];
    for (let start = 0; ; start += PAGE) {
        const r = await scan(cfg.scanner, start);
        rows.push(...(r.data || []));
        if (!r.data || r.data.length < PAGE) break;
    }

    // Keep only companies with a logo id, one row per company when a market has many venues.
    const seen = new Map();
    const picked = [];
    for (const row of rows) {
        const [name, desc, logoid, sector, industry, mcap, exch] = row.d;
        if (!name || !logoid) continue;
        if (cfg.dedupe) {
            const prev = seen.get(logoid);
            if (prev !== undefined) {
                const better = cfg.primary?.includes(exch) && !cfg.primary.includes(picked[prev].exch);
                if (better) picked[prev] = { name, desc, logoid, sector, industry, mcap, exch };
                continue;
            }
            seen.set(logoid, picked.length);
        }
        picked.push({ name, desc, logoid, sector, industry, mcap, exch });
    }

    const todo = [];
    const used = new Set();
    for (const p of picked) {
        const sym = p.name.toUpperCase().trim().replace(/[^A-Z0-9_.-]/g, '');
        if (!sym || used.has(sym)) continue;
        used.add(sym);
        p.sym = sym;
        const mk = `${key.toUpperCase()}:${sym}`;
        if (!meta[mk]) {
            meta[mk] = {
                symbol: sym, company: p.desc || sym, country: cfg.country, market: key.toUpperCase(),
                sector: p.sector || null, industry: p.industry || null, marketCap: p.mcap || null,
                logoid: p.logoid, yahooTicker: `${sym}${cfg.suffix}`,
                yahooUrl: `https://finance.yahoo.com/quote/${sym}${cfg.suffix}`,
            };
        }
        if (fs.existsSync(path.join(dir, `${sym}.svg`)) || fs.existsSync(path.join(dir, `${sym}.png`))) continue;
        todo.push(p);
    }

    const batch = limit ? todo.slice(0, limit) : todo;
    let saved = 0, missing = 0;
    await pool(batch, async (p) => {
        const svg = await fetchSvg(p.logoid);
        if (svg) { fs.writeFileSync(path.join(dir, `${p.sym}.svg`), svg); saved++; }
        else { missing++; delete meta[`${key.toUpperCase()}:${p.sym}`]; }
    });
    console.log(`[${key}] listed=${rows.length} withLogo=${picked.length} new=${saved} noLogo=${missing}`);
    return saved;
}

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const keys = opt('--markets') ? opt('--markets').split(',') : Object.keys(MARKETS);
const limit = opt('--limit') ? parseInt(opt('--limit'), 10) : 0;

const meta = fs.existsSync(META_FILE) ? JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) : {};
let total = 0;
for (const k of keys) {
    if (!MARKETS[k]) { console.warn(`Unknown market ${k}`); continue; }
    total += await crawlMarket(k, MARKETS[k], meta, limit);
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}
console.log(`Done. ${total} new logos.`);
