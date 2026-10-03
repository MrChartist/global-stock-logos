/**
 * crawler.js — Continuous Multi-Market Stock Logo & Metadata Ingestion Crawler
 * Systematically crawls all remaining equities across US (20,000+) and India (8,700+)
 * in polite background batches with cursor persistence, adaptive pacing, and auto-resume.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateProceduralSvg } from './generator.js';
import { syncGlobalCatalog } from './sync.js';
import { auditLogos } from './audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGOS_DIR = path.join(REPO_ROOT, 'logos');
const IN_DIR = path.join(LOGOS_DIR, 'in');
const US_DIR = path.join(LOGOS_DIR, 'us');
const STATE_FILE = path.join(REPO_ROOT, 'crawler-state.json');
const METADATA_FILE = path.join(REPO_ROOT, 'companies-metadata.json');

fs.mkdirSync(LOGOS_DIR, { recursive: true });
fs.mkdirSync(IN_DIR, { recursive: true });
fs.mkdirSync(US_DIR, { recursive: true });

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

const TV_ENDPOINTS = {
    us: 'https://scanner.tradingview.com/america/scan',
    in: 'https://scanner.tradingview.com/india/scan',
};

export function loadCrawlerState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        } catch (e) {
            console.warn('[crawler] Could not parse crawler-state.json, creating new state');
        }
    }
    return {
        usCursor: 1000,
        inCursor: 1200,
        usTotal: 20069,
        inTotal: 8717,
        batchesCompleted: 0,
        lastCrawledAt: null,
    };
}

export function saveCrawlerState(state) {
    state.lastCrawledAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function loadMetadata() {
    if (fs.existsSync(METADATA_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        } catch (e) {}
    }
    return {};
}

export function saveMetadata(meta) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

async function fetchTradingViewBatch(market, start, count) {
    const url = TV_ENDPOINTS[market];
    const filter = [{ left: 'type', operation: 'in_range', right: ['stock', 'dr'] }];
    if (market === 'in') {
        filter.push({ left: 'exchange', operation: 'in_range', right: ['NSE', 'BSE'] });
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': BROWSER_HEADERS['User-Agent'],
            },
            body: JSON.stringify({
                filter,
                columns: ['name', 'description', 'logoid', 'sector', 'industry', 'market_cap_basic'],
                sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
                range: [start, start + count],
            }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) return { totalCount: 0, data: [] };
        return await res.json();
    } catch (e) {
        console.error(`[crawler] Fetch error for ${market}:`, e.message);
        return { totalCount: 0, data: [] };
    }
}

async function fetchSvg(logoid) {
    if (!logoid) return null;
    const candidates = [
        `https://s3-symbol-logo.tradingview.com/${logoid}--big.svg`,
        `https://s3-symbol-logo.tradingview.com/${logoid}.svg`,
    ];
    for (const url of candidates) {
        try {
            const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const text = await res.text();
                if (text && text.includes('<svg') && text.includes('</svg>')) {
                    return text;
                }
            }
        } catch (e) {}
    }
    return null;
}

/**
 * Ingest a single batch for a market
 */
export async function crawlMarketBatch(market = 'us', batchSize = 50, state, metadata) {
    const mkt = market.toLowerCase();
    const destDir = mkt === 'us' ? US_DIR : IN_DIR;
    const cursorKey = mkt === 'us' ? 'usCursor' : 'inCursor';
    const totalKey = mkt === 'us' ? 'usTotal' : 'inTotal';

    const currentOffset = state[cursorKey] || 0;
    console.log(`[crawler] 📦 Crawling ${mkt.toUpperCase()} [${currentOffset} .. ${currentOffset + batchSize}]...`);

    const result = await fetchTradingViewBatch(mkt, currentOffset, batchSize);
    if (result.totalCount) state[totalKey] = result.totalCount;

    const rows = result.data || [];
    if (rows.length === 0) {
        console.log(`[crawler] Reached end of market ${mkt.toUpperCase()}`);
        return { count: 0, newLogos: 0 };
    }

    let newLogos = 0;

    for (const row of rows) {
        const [symRaw, desc, logoid, sector, industry, mcap] = row.d || [];
        if (!symRaw) continue;

        const sym = symRaw.toUpperCase().trim().replace(/[^A-Za-z0-9_.-]/g, '');
        const targetSvg = path.join(destDir, `${sym}.svg`);
        const targetPng = path.join(destDir, `${sym}.png`);

        // Index metadata
        metadata[`${mkt.toUpperCase()}:${sym}`] = {
            symbol: sym,
            company: desc || sym,
            logoid: logoid || null,
            sector: sector || null,
            industry: industry || null,
            marketCap: mcap || null,
            market: mkt.toUpperCase(),
        };

        if (fs.existsSync(targetSvg) || fs.existsSync(targetPng)) {
            continue;
        }

        // Try TradingView SVG
        let saved = false;
        if (logoid) {
            const svgContent = await fetchSvg(logoid);
            if (svgContent) {
                fs.writeFileSync(targetSvg, svgContent, 'utf-8');
                const rootSvg = path.join(LOGOS_DIR, `${sym}.svg`);
                if (!fs.existsSync(rootSvg) && !fs.existsSync(path.join(LOGOS_DIR, `${sym}.png`))) {
                    fs.writeFileSync(rootSvg, svgContent, 'utf-8');
                }
                saved = true;
                newLogos++;
                console.log(`  [${mkt.toUpperCase()}] ✅ ${sym}: Saved Vector SVG (${logoid})`);
            }
        }

        // Fallback procedural
        if (!saved) {
            const badge = generateProceduralSvg(sym, desc || sym);
            fs.writeFileSync(targetSvg, badge, 'utf-8');
            const rootSvg = path.join(LOGOS_DIR, `${sym}.svg`);
            if (!fs.existsSync(rootSvg) && !fs.existsSync(path.join(LOGOS_DIR, `${sym}.png`))) {
                fs.writeFileSync(rootSvg, badge, 'utf-8');
            }
            newLogos++;
            console.log(`  [${mkt.toUpperCase()}] 🎨 ${sym}: Generated procedural badge`);
        }

        // Polite delay
        await new Promise((r) => setTimeout(r, 50));
    }

    // Advance cursor
    state[cursorKey] = currentOffset + rows.length;
    return { count: rows.length, newLogos };
}

/**
 * Execute continuous or single-step crawler run
 */
export async function runCrawler({
    continuous = false,
    batchSize = 50,
    delaySec = 10,
    market = 'both',
    maxBatches = Infinity,
} = {}) {
    console.log(`\n======================================================`);
    console.log(`  🚀 Global Stock Logo Continuous Crawler Engine`);
    console.log(`  Mode: ${continuous ? 'Continuous Loop' : 'Single Batch'}`);
    console.log(`  Batch Size: ${batchSize} stocks | Delay: ${delaySec}s`);
    console.log(`======================================================\n`);

    const state = loadCrawlerState();
    const metadata = loadMetadata();

    let batchesRun = 0;
    let keepRunning = true;

    process.on('SIGINT', () => {
        console.log('\n[crawler] 🛑 Received interrupt. Saving state and syncing catalog...');
        keepRunning = false;
    });

    while (keepRunning && batchesRun < maxBatches) {
        batchesRun++;
        state.batchesCompleted = (state.batchesCompleted || 0) + 1;

        if (market === 'both' || market === 'us') {
            await crawlMarketBatch('us', batchSize, state, metadata);
        }

        if (market === 'both' || market === 'in') {
            await crawlMarketBatch('in', batchSize, state, metadata);
        }

        saveCrawlerState(state);
        saveMetadata(metadata);
        syncGlobalCatalog();

        console.log(`[crawler] 💾 Checkpoint saved. State: US Cursor=${state.usCursor}/${state.usTotal}, IN Cursor=${state.inCursor}/${state.inTotal}`);

        if (!continuous) break;

        console.log(`[crawler] ⏳ Sleeping ${delaySec}s before next batch...\n`);
        await new Promise((r) => setTimeout(r, delaySec * 1000));
    }

    console.log('\n[crawler] 🏁 Finished crawl cycle. Running audit...');
    auditLogos();
    console.log('[crawler] ✅ Crawler run complete!\n');
}

// CLI Execution support
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const args = process.argv.slice(2);
    let continuous = false;
    let batchSize = 50;
    let delaySec = 10;
    let market = 'both';
    let maxBatches = 1;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--continuous') {
            continuous = true;
            maxBatches = Infinity;
        } else if (args[i] === '--batch' && args[i + 1]) {
            batchSize = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--delay' && args[i + 1]) {
            delaySec = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--market' && args[i + 1]) {
            market = args[i + 1].toLowerCase();
            i++;
        } else if (args[i] === '--max-batches' && args[i + 1]) {
            maxBatches = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--reset') {
            const emptyState = { usCursor: 0, inCursor: 0, usTotal: 20069, inTotal: 8717, batchesCompleted: 0 };
            saveCrawlerState(emptyState);
            console.log('[crawler] Reset crawler-state.json to cursor 0');
        }
    }

    runCrawler({ continuous, batchSize, delaySec, market, maxBatches }).catch(console.error);
}
