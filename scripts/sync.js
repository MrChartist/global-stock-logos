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
import { MARKETS } from './markets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGOS_DIR = path.join(REPO_ROOT, 'logos');
const MANIFEST_PATH = path.join(REPO_ROOT, 'logos-manifest.json');

export const MARKET_METADATA = Object.fromEntries(
    Object.entries(MARKETS).map(([key, m]) => [key, {
        market: key.toUpperCase(),
        country: m.country,
        exchanges: m.exchanges,
        yahooSuffix: m.suffix,
    }])
);

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

    // Shard the catalog: a 70k+ entry single JSON exceeds GitHub (100MB) and jsDelivr (20MB) limits.
    const MANIFESTS_DIR = path.join(REPO_ROOT, 'manifests');
    fs.rmSync(MANIFESTS_DIR, { recursive: true, force: true });
    fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
    const cdnBase = `https://cdn.jsdelivr.net/gh/${repoName}@main/logos`;
    const shards = {};
    const searchIndex = [];
    for (const [k, item] of Object.entries(logos)) {
        if (!k.includes(':')) continue; // namespaced MARKET:SYM keys only
        const mk = item.market.toLowerCase();
        (shards[mk] ||= {})[item.symbol] = {
            company: item.company, format: item.format, sector: item.sector, industry: item.industry,
            marketCap: item.marketCap, logoid: item.logoid, yahooTicker: item.yahooTicker,
            yahooUrl: item.yahooUrl, path: item.path,
        };
        searchIndex.push([item.symbol, item.company, item.market, item.format, item.yahooTicker]);
    }
    const marketFiles = {};
    for (const [mk, items] of Object.entries(shards)) {
        fs.writeFileSync(path.join(MANIFESTS_DIR, `${mk}.json`), JSON.stringify(items));
        marketFiles[mk.toUpperCase()] = `manifests/${mk}.json`;
    }
    fs.writeFileSync(path.join(REPO_ROOT, 'search-index.json'), JSON.stringify(searchIndex));

    const manifest = {
        name: "Global Stock Logos Catalog (World)",
        version: "3.0.0",
        updatedAt: new Date().toISOString(),
        totalEquities,
        stats: { markets: marketCounts, formats: { svg: svgs, png: pngs } },
        cdnBase,
        searchIndex: 'search-index.json',
        marketManifests: marketFiles,
    };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    fs.rmSync(path.join(LOGOS_DIR, 'logos-manifest.json'), { force: true });

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
