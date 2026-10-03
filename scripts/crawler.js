/**
 * crawler.js — Autonomous Global Multi-Market Stock Logo & Metadata Ingestion Agent
 * Systematically crawls all stock markets worldwide:
 * - 🇮🇳 India (NSE & BSE)
 * - 🇺🇸 United States (NASDAQ & NYSE)
 * - 🇬🇧 United Kingdom (LSE)
 * - 🇩🇪 Germany (XETRA)
 * - 🇫🇷 France (Euronext Paris)
 * - 🇯🇵 Japan (TSE)
 * - 🇨🇦 Canada (TSX)
 * - 🇦🇺 Australia (ASX)
 * - 🇭🇰 Hong Kong (HKEX)
 *
 * Persists cursor state per-market in crawler-state.json and links every company to Yahoo Finance.
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
const STATE_FILE = path.join(REPO_ROOT, 'crawler-state.json');
const METADATA_FILE = path.join(REPO_ROOT, 'companies-metadata.json');

fs.mkdirSync(LOGOS_DIR, { recursive: true });

export const WORLD_MARKETS = {
    us: { name: 'United States', endpoint: 'https://scanner.tradingview.com/america/scan', yahooSuffix: '', exchanges: ['NASDAQ', 'NYSE'] },
    in: { name: 'India', endpoint: 'https://scanner.tradingview.com/india/scan', yahooSuffix: '.NS', exchanges: ['NSE', 'BSE'] },
    uk: { name: 'United Kingdom', endpoint: 'https://scanner.tradingview.com/uk/scan', yahooSuffix: '.L', exchanges: ['LSE'] },
    germany: { name: 'Germany', endpoint: 'https://scanner.tradingview.com/germany/scan', yahooSuffix: '.DE', exchanges: ['XETRA'] },
    france: { name: 'France', endpoint: 'https://scanner.tradingview.com/france/scan', yahooSuffix: '.PA', exchanges: ['Euronext Paris'] },
    japan: { name: 'Japan', endpoint: 'https://scanner.tradingview.com/japan/scan', yahooSuffix: '.T', exchanges: ['TSE'] },
    canada: { name: 'Canada', endpoint: 'https://scanner.tradingview.com/canada/scan', yahooSuffix: '.TO', exchanges: ['TSX'] },
    australia: { name: 'Australia', endpoint: 'https://scanner.tradingview.com/australia/scan', yahooSuffix: '.AX', exchanges: ['ASX'] },
    hongkong: { name: 'Hong Kong', endpoint: 'https://scanner.tradingview.com/hongkong/scan', yahooSuffix: '.HK', exchanges: ['HKEX'] },
};

// Ensure market directories exist
for (const m of Object.keys(WORLD_MARKETS)) {
    fs.mkdirSync(path.join(LOGOS_DIR, m), { recursive: true });
}

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

export function loadCrawlerState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        } catch (e) {
            console.warn('[crawler] Could not parse crawler-state.json, creating new state');
        }
    }
    const state = {
        batchesCompleted: 0,
        lastCrawledAt: null,
        markets: {}
    };
    for (const m of Object.keys(WORLD_MARKETS)) {
        state.markets[m] = { cursor: 0, total: 0 };
    }
    return state;
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

async function fetchMarketScannerBatch(endpoint, start, count, market) {
    const filter = [{ left: 'type', operation: 'in_range', right: ['stock', 'dr'] }];
    if (market === 'in') {
        filter.push({ left: 'exchange', operation: 'in_range', right: ['NSE', 'BSE'] });
    }

    try {
        const res = await fetch(endpoint, {
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
 * Ingest a single batch for a specified world market
 */
export async function crawlMarketBatch(market = 'us', batchSize = 50, state, metadata) {
    const mkt = market.toLowerCase();
    const config = WORLD_MARKETS[mkt] || WORLD_MARKETS.us;
    const destDir = path.join(LOGOS_DIR, mkt);
    fs.mkdirSync(destDir, { recursive: true });

    if (!state.markets) state.markets = {};
    if (!state.markets[mkt]) state.markets[mkt] = { cursor: 0, total: 0 };

    const currentOffset = state.markets[mkt].cursor || 0;
    console.log(`[crawler] 📦 [${config.name.toUpperCase()}] Fetching batch [${currentOffset} .. ${currentOffset + batchSize}]...`);

    const result = await fetchMarketScannerBatch(config.endpoint, currentOffset, batchSize, mkt);
    if (result.totalCount) state.markets[mkt].total = result.totalCount;

    const rows = result.data || [];
    if (rows.length === 0) {
        console.log(`[crawler] Reached end of market: ${config.name}`);
        return { count: 0, newLogos: 0 };
    }

    let newLogos = 0;

    for (const row of rows) {
        const [symRaw, desc, logoid, sector, industry, mcap] = row.d || [];
        if (!symRaw) continue;

        const sym = symRaw.toUpperCase().trim().replace(/[^A-Za-z0-9_.-]/g, '');
        const targetSvg = path.join(destDir, `${sym}.svg`);
        const targetPng = path.join(destDir, `${sym}.png`);

        const yahooTicker = `${sym}${config.yahooSuffix}`;

        // Index metadata
        metadata[`${mkt.toUpperCase()}:${sym}`] = {
            symbol: sym,
            company: desc || sym,
            country: config.name,
            market: mkt.toUpperCase(),
            sector: sector || null,
            industry: industry || null,
            marketCap: mcap || null,
            logoid: logoid || null,
            yahooTicker,
            yahooUrl: `https://finance.yahoo.com/quote/${yahooTicker}`
        };

        if (fs.existsSync(targetSvg) || fs.existsSync(targetPng)) {
            continue;
        }

        // Try Vector SVG
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

        await new Promise((r) => setTimeout(r, 40));
    }

    state.markets[mkt].cursor = currentOffset + rows.length;
    return { count: rows.length, newLogos };
}

/**
 * Execute continuous or multi-market crawler run
 */
export async function runCrawler({
    continuous = false,
    batchSize = 25,
    delaySec = 8,
    markets = ['us', 'in', 'uk', 'germany', 'japan', 'canada', 'australia', 'hongkong'],
    maxBatches = 1,
} = {}) {
    console.log(`\n======================================================`);
    console.log(`  🌍 Universal Global Stock Market Crawler Agent`);
    console.log(`  Markets: ${markets.map(m => m.toUpperCase()).join(', ')}`);
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

        for (const mkt of markets) {
            if (!keepRunning) break;
            await crawlMarketBatch(mkt, batchSize, state, metadata);
        }

        saveCrawlerState(state);
        saveMetadata(metadata);
        syncGlobalCatalog();

        console.log(`[crawler] 💾 Checkpoint saved for cycle ${batchesRun}`);

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
    let batchSize = 25;
    let delaySec = 8;
    let markets = ['us', 'in', 'uk', 'germany', 'japan', 'canada', 'australia', 'hongkong'];
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
            markets = [args[i + 1].toLowerCase()];
            i++;
        } else if (args[i] === '--markets' && args[i + 1]) {
            markets = args[i + 1].toLowerCase().split(',');
            i++;
        } else if (args[i] === '--max-batches' && args[i + 1]) {
            maxBatches = parseInt(args[i + 1], 10);
            i++;
        }
    }

    runCrawler({ continuous, batchSize, delaySec, markets, maxBatches }).catch(console.error);
}
