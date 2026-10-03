/**
 * scrape-all.js — Comprehensive Multi-Market Stock Logos Scraper Engine
 * Scrapes all available companies from TradingView Scanner API:
 * - US Market:    https://scanner.tradingview.com/america/scan
 * - Indian Market: https://scanner.tradingview.com/india/scan
 *
 * Waterfall Intake Strategy:
 * 1. TradingView S3 Vector SVG (https://s3-symbol-logo.tradingview.com/<logoid>--big.svg)
 * 2. TradingView S3 Standard SVG (https://s3-symbol-logo.tradingview.com/<logoid>.svg)
 * 3. Google Favicon V2 (128px high-res PNG)
 * 4. Procedural Vector SVG Badge (deterministic gradient monogram)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateProceduralSvg } from './generator.js';
import { syncGlobalCatalog } from './sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGOS_DIR = path.join(REPO_ROOT, 'logos');
const IN_DIR = path.join(LOGOS_DIR, 'in');
const US_DIR = path.join(LOGOS_DIR, 'us');

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
    in: 'https://scanner.tradingview.com/india/scan'
};

/**
 * Fetch a batch of equities from TradingView scanner
 */
async function fetchScannerBatch(market = 'us', startIndex = 0, batchSize = 100) {
    const url = TV_ENDPOINTS[market] || TV_ENDPOINTS.us;
    const filter = [
        { left: 'type', operation: 'in_range', right: ['stock', 'dr'] }
    ];

    if (market === 'in') {
        filter.push({ left: 'exchange', operation: 'in_range', right: ['NSE', 'BSE'] });
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': BROWSER_HEADERS['User-Agent']
            },
            body: JSON.stringify({
                filter,
                columns: ['name', 'description', 'logoid', 'sector', 'industry', 'market_cap_basic'],
                sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
                range: [startIndex, startIndex + batchSize]
            }),
            signal: AbortSignal.timeout(15000)
        });

        if (!res.ok) {
            console.warn(`[scanner] HTTP error ${res.status} from ${url}`);
            return { totalCount: 0, data: [] };
        }

        return await res.json();
    } catch (e) {
        console.error(`[scanner] Fetch error: ${e.message}`);
        return { totalCount: 0, data: [] };
    }
}

/**
 * Attempt to download vector SVG from TradingView S3 CDN
 */
async function fetchTradingViewSvg(logoid) {
    if (!logoid) return null;
    const urls = [
        `https://s3-symbol-logo.tradingview.com/${logoid}--big.svg`,
        `https://s3-symbol-logo.tradingview.com/${logoid}.svg`
    ];

    for (const u of urls) {
        try {
            const res = await fetch(u, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const text = await res.text();
                if (text && text.includes('<svg') && text.includes('</svg>')) {
                    return text;
                }
            }
        } catch (e) {
            // continue to fallback
        }
    }
    return null;
}

/**
 * Main scraper worker for a market
 */
export async function scrapeMarketLogos({ market = 'us', limit = 300 } = {}) {
    const mkt = market.toLowerCase();
    const destDir = mkt === 'us' ? US_DIR : IN_DIR;
    console.log(`\n======================================================`);
    console.log(`  🌐 Scraping Market: ${mkt.toUpperCase()} (Target Limit: ${limit})`);
    console.log(`======================================================`);

    const batchSize = 100;
    let processed = 0;
    let svgsDownloaded = 0;
    let proceduralCreated = 0;
    let alreadyExisted = 0;

    for (let start = 0; start < limit; start += batchSize) {
        const curBatchSize = Math.min(batchSize, limit - start);
        console.log(`[scraper] Fetching ${mkt.toUpperCase()} batch [${start} .. ${start + curBatchSize}]...`);
        const result = await fetchScannerBatch(mkt, start, curBatchSize);

        const rows = result.data || [];
        if (rows.length === 0) {
            console.log(`[scraper] No more rows returned.`);
            break;
        }

        for (const row of rows) {
            const [symRaw, desc, logoid] = row.d || [];
            if (!symRaw) continue;

            const sym = symRaw.toUpperCase().trim().replace(/[^A-Za-z0-9_.-]/g, '');
            const targetSvg = path.join(destDir, `${sym}.svg`);
            const targetPng = path.join(destDir, `${sym}.png`);

            // If already present, skip re-download
            if (fs.existsSync(targetSvg) || fs.existsSync(targetPng)) {
                alreadyExisted++;
                processed++;
                continue;
            }

            // 1. Try TradingView Vector SVG (Highest fidelity)
            let downloaded = false;
            if (logoid) {
                const svgContent = await fetchTradingViewSvg(logoid);
                if (svgContent) {
                    fs.writeFileSync(targetSvg, svgContent, 'utf-8');
                    // Flat mirror
                    const rootSvg = path.join(LOGOS_DIR, `${sym}.svg`);
                    if (!fs.existsSync(rootSvg) && !fs.existsSync(path.join(LOGOS_DIR, `${sym}.png`))) {
                        fs.writeFileSync(rootSvg, svgContent, 'utf-8');
                    }
                    svgsDownloaded++;
                    downloaded = true;
                    process.stdout.write(`  [${mkt.toUpperCase()}] ✅ ${sym}: Saved Vector SVG from TradingView (${logoid})\n`);
                }
            }

            // 2. Procedural SVG Fallback if no TV logo
            if (!downloaded) {
                const svgBadge = generateProceduralSvg(sym, desc || sym);
                fs.writeFileSync(targetSvg, svgBadge, 'utf-8');
                const rootSvg = path.join(LOGOS_DIR, `${sym}.svg`);
                if (!fs.existsSync(rootSvg) && !fs.existsSync(path.join(LOGOS_DIR, `${sym}.png`))) {
                    fs.writeFileSync(rootSvg, svgBadge, 'utf-8');
                }
                proceduralCreated++;
                process.stdout.write(`  [${mkt.toUpperCase()}] 🎨 ${sym}: Generated procedural vector badge\n`);
            }

            processed++;
            // Polite pacing
            await new Promise(r => setTimeout(r, 40));
        }
    }

    console.log(`\n------------------------------------------------------`);
    console.log(`  ${mkt.toUpperCase()} Scrape Completed:`);
    console.log(`  ✅ Vector SVGs Downloaded : ${svgsDownloaded}`);
    console.log(`  🎨 Procedural Badges      : ${proceduralCreated}`);
    console.log(`  ⏩ Already Existed        : ${alreadyExisted}`);
    console.log(`  📁 Total Processed        : ${processed}`);
    console.log(`------------------------------------------------------\n`);

    return { svgsDownloaded, proceduralCreated, alreadyExisted, processed };
}

/**
 * Execute full global scraping for both US and India
 */
export async function scrapeAllGlobal({ usLimit = 500, inLimit = 500 } = {}) {
    console.log('🚀 Starting Universal Global Logo Scraper (US + India)...');
    
    // 1. Scrape US
    await scrapeMarketLogos({ market: 'us', limit: usLimit });

    // 2. Scrape India
    await scrapeMarketLogos({ market: 'in', limit: inLimit });

    // 3. Re-index catalog
    console.log('🔄 Re-indexing global catalog manifest...');
    syncGlobalCatalog();
    console.log('🎉 Global Scrape & Sync Complete!');
}

// CLI Execution support
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const args = process.argv.slice(2);
    let usLimit = 300;
    let inLimit = 300;

    if (args.includes('--all')) {
        usLimit = 1000;
        inLimit = 1000;
    }

    scrapeAllGlobal({ usLimit, inLimit }).catch(console.error);
}
