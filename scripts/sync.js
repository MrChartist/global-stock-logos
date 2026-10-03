/**
 * sync.js — Universal Multi-Market Stock Logos Manifest Indexer
 * Dynamically indexes all international markets:
 * - 🇮🇳 India (NSE / BSE): logos/in/
 * - 🇺🇸 United States (NASDAQ / NYSE / S&P 500): logos/us/
 * - 🇬🇧 United Kingdom (LSE): logos/uk/
 * - 🇩🇪 Germany & Europe (XETRA): logos/germany/
 * - 🇯🇵 Japan (TSE): logos/japan/
 * - 🇨🇦 Canada (TSX): logos/canada/
 * - 🇦🇺 Australia (ASX): logos/australia/
 * - 🇭🇰 Hong Kong (HKEX): logos/hongkong/
 * - 🌐 Unified Flat CDN: logos/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { US_KNOWN_DOMAINS } from './domains-us.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGOS_DIR = path.join(REPO_ROOT, 'logos');
const MANIFEST_PATH = path.join(REPO_ROOT, 'logos-manifest.json');

export const MARKET_METADATA = {
    in: { market: 'IN', country: 'India', exchanges: ['NSE', 'BSE'], yahooSuffix: '.NS' },
    us: { market: 'US', country: 'United States', exchanges: ['NASDAQ', 'NYSE'], yahooSuffix: '' },
    uk: { market: 'UK', country: 'United Kingdom', exchanges: ['LSE'], yahooSuffix: '.L' },
    germany: { market: 'GERMANY', country: 'Germany', exchanges: ['XETRA'], yahooSuffix: '.DE' },
    france: { market: 'FRANCE', country: 'France', exchanges: ['Euronext Paris'], yahooSuffix: '.PA' },
    japan: { market: 'JAPAN', country: 'Japan', exchanges: ['TSE'], yahooSuffix: '.T' },
    canada: { market: 'CANADA', country: 'Canada', exchanges: ['TSX'], yahooSuffix: '.TO' },
    australia: { market: 'AUSTRALIA', country: 'Australia', exchanges: ['ASX'], yahooSuffix: '.AX' },
    hongkong: { market: 'HONGKONG', country: 'Hong Kong', exchanges: ['HKEX'], yahooSuffix: '.HK' },
};

export function syncGlobalCatalog(repoName = 'MrChartist/global-stock-logos') {
    console.log('[sync] 🌐 Scanning Global Logo Assets...');

    let existing = { logos: {} };
    if (fs.existsSync(MANIFEST_PATH)) {
        try {
            existing = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
            if (!existing.logos) existing.logos = {};
        } catch (e) {}
    }

    const METADATA_PATH = path.join(REPO_ROOT, 'companies-metadata.json');
    let companyMeta = {};
    if (fs.existsSync(METADATA_PATH)) {
        try { companyMeta = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8')); } catch (e) {}
    }

    const logos = {};
    const marketCounts = {};
    let totalEquities = 0;
    let svgs = 0;
    let pngs = 0;

    // Detect all market subdirectories in logos/
    const subDirs = fs.readdirSync(LOGOS_DIR).filter(d => {
        try { return fs.statSync(path.join(LOGOS_DIR, d)).isDirectory(); } catch(e) { return false; }
    });

    for (const mktKey of subDirs) {
        const mktLower = mktKey.toLowerCase();
        const mktConfig = MARKET_METADATA[mktLower] || {
            market: mktKey.toUpperCase(),
            country: mktKey.toUpperCase(),
            exchanges: [mktKey.toUpperCase()],
            yahooSuffix: '',
        };

        const dirPath = path.join(LOGOS_DIR, mktKey);
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.svg') || f.endsWith('.png'));
        let count = 0;

        for (const file of files) {
            const ext = path.extname(file).replace('.', '').toLowerCase();
            const sym = path.basename(file, '.' + ext).toUpperCase();
            const stats = fs.statSync(path.join(dirPath, file));
            if (ext === 'svg') svgs++; else pngs++;
            count++;
            totalEquities++;

            const usMeta = mktLower === 'us' ? (US_KNOWN_DOMAINS[sym] || {}) : {};
            const prev = existing.logos[sym] || existing.logos[`${mktConfig.market}:${sym}`] || {};
            const meta = companyMeta[`${mktConfig.market}:${sym}`] || companyMeta[sym] || {};

            const yahooTicker = `${sym}${mktConfig.yahooSuffix}`;
            const item = {
                symbol: sym,
                company: meta.company || usMeta.name || prev.company || sym,
                market: mktConfig.market,
                country: mktConfig.country,
                exchanges: mktConfig.exchanges,
                format: ext,
                sector: meta.sector || prev.sector || null,
                industry: meta.industry || prev.industry || null,
                marketCap: meta.marketCap || prev.marketCap || null,
                logoid: meta.logoid || prev.logoid || null,
                yahooTicker,
                yahooUrl: `https://finance.yahoo.com/quote/${yahooTicker}`,
                yahooApiUrl: `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`,
                path: `logos/${mktLower}/${file}`,
                cdnMarketUrl: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos/${mktLower}/${file}`,
                cdnDirectUrl: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos/${file}`,
                sizeBytes: stats.size,
                isProcedural: prev.isProcedural ?? (ext === 'svg' && stats.size < 2500),
                updatedAt: prev.updatedAt || new Date().toISOString()
            };

            logos[`${mktConfig.market}:${sym}`] = item;
            if (!logos[sym]) logos[sym] = item; // alias if no collision
        }

        marketCounts[mktConfig.market] = count;
    }

    const manifest = {
        name: "Global Stock Logos Catalog (India, US & World)",
        version: "2.1.0",
        updatedAt: new Date().toISOString(),
        totalEquities,
        stats: {
            markets: marketCounts,
            formats: {
                svg: svgs,
                png: pngs
            }
        },
        cdnBase: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos`,
        logos
    };

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

    // Also mirror to logos/logos-manifest.json for convenience
    try {
        fs.writeFileSync(path.join(LOGOS_DIR, 'logos-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    } catch(e) {}

    console.log(`[sync] ✅ Successfully indexed ${totalEquities} Global Equities across ${Object.keys(marketCounts).length} markets:`);
    for (const [m, c] of Object.entries(marketCounts)) {
        console.log(`  🌐 ${m} : ${c}`);
    }
    console.log(`  🎨 Formats : ${svgs} SVGs, ${pngs} PNGs`);

    return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    syncGlobalCatalog();
}
