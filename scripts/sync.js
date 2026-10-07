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
import { applyAliases, loadAliases } from './apply-aliases.js';
import { groupListings, logoHash } from './listings.js';

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

/**
 * The ticker as Yahoo Finance writes it. Our file names cannot hold every character: Yahoo uses BRK-B (US share
 * classes), NOVO-B.CO (Nordic share classes) and M&M.NS / BAJAJ-AUTO.NS (India), where we store BRK.B, NOVO_B, M_M.
 * India: only when an alias proves the exchange spelling (curated/aliases.json); otherwise the ticker is left as is.
 */
const NORDIC = new Set(['sweden', 'denmark', 'finland', 'norway', 'iceland']);
export function yahooSymbol(market, sym, others = []) {
    if (market === 'us') return sym.replace(/\./g, '-');
    if (NORDIC.has(market)) return sym.replace(/_/g, '-');
    if (market === 'in' && sym.includes('_')) return others.find((o) => o.replace(/[&-]/g, '_') === sym) || sym;
    return sym;
}

export function syncGlobalCatalog(repoName = 'MrChartist/global-stock-logos') {
    console.log('[sync] 🌐 Scanning Global Logo Assets...');

    // Repair tickers that carry a placeholder (special characters, renamed companies) BEFORE indexing: see curated/aliases.json
    const aliasRun = applyAliases();
    const aliases = loadAliases();
    // MARKET:TICKER -> the other tickers that point at its logo (exchange spelling M&M, former ticker ZOMATO), for search.
    const otherTickers = {};
    for (const [k, a] of Object.entries(aliases)) {
        const market = k.slice(0, k.indexOf(':'));
        (otherTickers[`${market}:${a.logoOf}`] ||= []).push(k.slice(k.indexOf(':') + 1));
    }
    console.log(`[sync] 🔗 Aliases: ${aliasRun.applied} repaired, ${aliasRun.upToDate} already correct`);

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
            const bytes = fs.readFileSync(path.join(dirPath, file));
            // An alias file is a copy of another company's logo file (renamed ticker, or a ticker with a special character).
            // It gets its own manifest entry, but it is not a new company: it is not counted and not added to the search index.
            let logoOf = null;
            const aliasInfo = aliases[`${mktConfig.market}:${sym}`];
            if (aliasInfo) {
                const cf = ['svg', 'png'].map((x) => path.join(dirPath, `${aliasInfo.logoOf}.${x}`)).find((x) => fs.existsSync(x));
                if (cf && fs.readFileSync(cf).equals(bytes)) logoOf = aliasInfo.logoOf;
            }
            if (!logoOf) {
                if (ext === 'svg') svgs++; else pngs++;
                count++;
                totalEquities++;
            }

            const usMeta = mktLower === 'us' ? (US_KNOWN_DOMAINS[sym] || {}) : {};
            const metaOf = (k) => companyMeta[`${mktConfig.market}:${k}`] || companyMeta[k];
            const meta = metaOf(sym) || (logoOf ? metaOf(logoOf) : null) || {};

            const yahooTicker = `${yahooSymbol(mktLower, sym, otherTickers[`${mktConfig.market}:${sym}`])}${mktConfig.yahooSuffix}`;
            const item = {
                symbol: sym,
                logoOf,
                company: meta.company || usMeta.name || sym,
                market: mktConfig.market,
                country: mktConfig.country,
                exchanges: mktConfig.exchanges,
                format: ext,
                sector: meta.sector || null,
                industry: meta.industry || null,
                marketCap: meta.marketCap || null,
                logoid: meta.logoid || null,
                yahooTicker,
                yahooUrl: `https://finance.yahoo.com/quote/${yahooTicker}`,
                yahooApiUrl: `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`,
                path: `logos/${mktLower}/${file}`,
                cdnMarketUrl: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos/${mktLower}/${file}`,
                cdnDirectUrl: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos/${file}`,
                sizeBytes: stats.size,
                isProcedural: ext === 'svg' && isProcedural(bytes.toString('utf-8', 0, 1500)),
                hash: logoHash(bytes),
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
    const listings = [];
    for (const [k, item] of Object.entries(logos)) {
        if (!k.includes(':')) continue; // namespaced MARKET:SYM keys only
        const mk = item.market.toLowerCase();
        const shard = (enrichment[mk] ||= loadShard(mk));
        const e = shard[item.symbol] || (item.logoOf ? shard[item.logoOf] : null) || {};
        const o = curated[k] || {};
        const pick = (f) => (o[f] !== undefined ? o[f] : e[f] ?? null);
        // A curated value names its source, so the API does not credit it to the automatic source it replaced.
        const sources = Object.keys(o).length ? { ...(e.sources || {}), ...Object.fromEntries(Object.keys(o).filter((f) => !f.startsWith('_')).map((f) => [f, 'curated'])) } : e.sources || null;
        const pngBase = e.pngSizes ? Object.fromEntries(e.pngSizes.map((n) => [n, `png/${n}/${mk}/${item.logoOf || item.symbol}.png`])) : null;
        (shards[mk] ||= {})[item.symbol] = {
            logoOf: item.logoOf || undefined,   // only present on aliases (JSON drops undefined)
            company: item.company, format: item.format, sector: item.sector, industry: item.industry,
            marketCap: item.marketCap, capCurrency: pick('capCurrency'), marketCapUsd: pick('marketCapUsd'), marketCapInr: pick('marketCapInr'), logoid: item.logoid, yahooTicker: item.yahooTicker,
            yahooUrl: item.yahooUrl, path: item.path, isProcedural: item.isProcedural,
            // Profile (all values may be null: unknown means Needs verification, never guessed)
            exchange: pick('exchange'), currency: pick('currency'), isin: pick('isin'),
            country: pick('country'), countryCode: pick('countryCode'), flag: pick('flag'),
            website: pick('website'), founded: pick('founded'), headquarters: pick('headquarters'),
            ceo: pick('ceo'), ceoSince: pick('ceoSince'), employees: pick('employees'), aliases: pick('aliases') || [],
            chairman: pick('chairman'), address: pick('address'), addressLocal: pick('addressLocal'), headquartersLocal: pick('headquartersLocal'),
            listingDate: pick('listingDate'), lei: pick('lei'), legalName: pick('legalName'), cik: pick('cik'),
            sources, checks: e.checks || null,
            slogan: pick('slogan'), brandColor: pick('brandColor'), brandColorSource: pick('brandColorSource'),
            wikidata: pick('wikidata'), pngPaths: pngBase,
            freshness: { marketData: e.marketDataAt || null, profile: e.wikidataAt || null },
        };
        if (item.logoOf) continue;
        // [ticker, name, market, format, yahooTicker, marketCapUsd, flags, otherTickers?]
        // flags: 1 secondary listing, 2 generated badge, 4 listed in the company's own country
        const home = !e.country || e.country === item.country;
        const row = [item.symbol, item.company, item.market, item.format, item.yahooTicker, e.marketCapUsd ?? null, (item.isProcedural ? 2 : 0) | (home ? 4 : 0)];
        if (otherTickers[k]) row.push(otherTickers[k]);
        searchIndex.push(row);
        listings.push({ market: mk, sym: item.symbol, name: item.company, cap: e.marketCapUsd, home, exchangeSpelling: !!otherTickers[k]?.some((o) => /[&-]/.test(o)), dr: e.type === 'dr', brand: item.logoid || item.hash, stale: !!e.notInScan });
    }
    // A copy of a company listed elsewhere (CEDEAR, BDR, depositary receipt, cross-listing) ranks below main listings.
    // Same company = identical logo and a market cap within 5%; see listings.js.
    const { secondary } = groupListings(listings);
    for (const key of secondary) {
        const [mk, sym] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
        shards[mk][sym].secondaryListing = true;
        foreignListing.add(`${mk.toUpperCase()}:${sym}`);
    }
    for (const row of searchIndex) if (foreignListing.has(`${row[2]}:${row[0]}`)) row[6] |= 1;
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
    // The 2,000 largest companies (first screens of the catalogue) as a small file, so a page can render before the full index arrives.
    fs.writeFileSync(path.join(REPO_ROOT, 'search-index-top.json'), JSON.stringify(searchIndex.slice(0, 2000)));

    const manifest = {
        name: "Global Stock Logos Catalog (World)",
        version: "3.0.0",
        updatedAt: new Date().toISOString(),
        totalEquities,
        stats: { markets: marketCounts, formats: { svg: svgs, png: pngs } },
        cdnBase,
        searchIndex: 'search-index.json',
        searchIndexTop: 'search-index-top.json',
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
