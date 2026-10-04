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
import { isProcedural } from './svg-quality.js';
import { loadShard } from './enrich-store.js';

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
            // Prefer the vector when both formats exist for the same symbol.
            if (file.endsWith('.png') && files.includes(file.replace(/\.png$/, '.svg'))) continue;
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
                isProcedural: ext === 'svg' && isProcedural(fs.readFileSync(path.join(dirPath, file), 'utf-8').slice(0, 1500)),
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
    // Hand-curated facts (e.g. slogan, corrected website) always win over automatic data.
    const curatedFile = path.join(REPO_ROOT, 'curated', 'overrides.json');
    const curated = fs.existsSync(curatedFile) ? JSON.parse(fs.readFileSync(curatedFile, 'utf-8')) : {};
    const enrichment = {};
    const foreignListing = new Set();
    for (const [k, item] of Object.entries(logos)) {
        if (!k.includes(':')) continue; // namespaced MARKET:SYM keys only
        const mk = item.market.toLowerCase();
        const e = (enrichment[mk] ||= loadShard(mk))[item.symbol] || {};
        const o = curated[k] || {};
        const pick = (f) => (o[f] !== undefined ? o[f] : e[f] ?? null);
        const pngBase = e.pngSizes ? Object.fromEntries(e.pngSizes.map((n) => [n, `png/${n}/${mk}/${item.symbol}.png`])) : null;
        (shards[mk] ||= {})[item.symbol] = {
            company: item.company, format: item.format, sector: item.sector, industry: item.industry,
            marketCap: item.marketCap, capCurrency: pick('capCurrency'), marketCapUsd: pick('marketCapUsd'), marketCapInr: pick('marketCapInr'), logoid: item.logoid, yahooTicker: item.yahooTicker,
            yahooUrl: item.yahooUrl, path: item.path, isProcedural: item.isProcedural,
            // Profile (all values may be null: unknown means Needs verification, never guessed)
            exchange: pick('exchange'), currency: pick('currency'), isin: pick('isin'),
            country: pick('country'), countryCode: pick('countryCode'), flag: pick('flag'),
            website: pick('website'), founded: pick('founded'), headquarters: pick('headquarters'),
            ceo: pick('ceo'), employees: pick('employees'), aliases: pick('aliases') || [],
            chairman: pick('chairman'), address: pick('address'), addressLocal: pick('addressLocal'), headquartersLocal: pick('headquartersLocal'),
            listingDate: pick('listingDate'), lei: pick('lei'), legalName: pick('legalName'), cik: pick('cik'),
            sources: e.sources || null, checks: e.checks || null,
            slogan: pick('slogan'), brandColor: pick('brandColor'), brandColorSource: pick('brandColorSource'),
            wikidata: pick('wikidata'), pngPaths: pngBase,
            freshness: { marketData: e.marketDataAt || null, profile: e.wikidataAt || null },
        };
        searchIndex.push([item.symbol, item.company, item.market, item.format, item.yahooTicker]);
        // A depositary receipt of a foreign company (company country differs from the market's country) ranks below home listings.
        if (e.country && e.country !== item.country) foreignListing.add(`${item.market}:${item.symbol}`);
    }
    // Biggest companies first, so catalogues and search boxes show the most useful entries by default.
    const capOf = (sym, market) => shards[market.toLowerCase()]?.[sym]?.marketCapUsd || 0;
    const rank = (r) => (foreignListing.has(`${r[2]}:${r[0]}`) ? 0 : 1);
    searchIndex.sort((a, b) => rank(b) - rank(a) || capOf(b[0], b[2]) - capOf(a[0], a[2]));
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
        marketNames: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k.toUpperCase(), m.country])),
        dataRefreshedAt: new Date().toISOString().slice(0, 10),
        pngSizes: [64, 128, 256, 512],
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
