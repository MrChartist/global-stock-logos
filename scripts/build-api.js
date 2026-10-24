/**
 * build-api.js — Build the static JSON API (api/v1/) from the manifests.
 *
 *   api/v1/index.json                          API root: version, endpoints, counts, freshness
 *   api/v1/markets.json                        every market with country, currency, company count
 *   api/v1/markets/<market>.json               slim list of the market's companies, largest first
 *   api/v1/companies/<market>/<TICKER>.json    the full profile of one company
 *   api/v1/isin/<ISIN>.json                    pointer from an ISIN to its primary listing (home market first) and the other lines that share it
 *   api/v1/lookup/<EXCHANGE>-<TICKER>.json     pointer from an exchange code and ticker (NASDAQ-AAPL, NSE-TCS) to the company
 *   api/v1/brands.json                         every brand (consumer brand, sub-brand, subsidiary) with its listed parent
 *   api/v1/brands/<slug>.json                  one brand
 *   api/v1/institutions.json                   market institutions: regulators, governments, exchanges, depositories, payment systems
 *   api/v1/institutions/<slug>.json            one institution
 *   api/v1/entities.json                       every brand and institution in one small search index
 *   api/v1/schema/{company,brand,institution}.schema.json   JSON Schemas
 *   api/v1/openapi.json                        OpenAPI 3.1 description of all of the above
 *
 * Everything is a plain file, so it is served by jsDelivr or GitHub Pages with no server.
 * Run after sync.js:  node scripts/build-api.js
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from './enrich-store.js';
import { MARKETS } from './markets.js';
import { loadBrands, brandPngSizes } from './brands.js';
import { loadInstitutions, pngSizesOf } from './institutions.js';
import { brandInk } from './brand-ink.js';

export const API_VERSION = 'v1';
const OUT = path.join(ROOT, 'api', API_VERSION);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'logos-manifest.json'), 'utf-8'));
const CDN = manifest.cdnBase.replace(/\/logos$/, '');
const API_BASE = `${CDN}/api/${API_VERSION}`;

/** Wikidata officers can be years out of date; exchange and registry officers are kept by a vendor;
 *  a URL is a hand check against the company's own page or filing (curated/overrides.json). */
const confidence = (source) => (source === 'wikidata' || source === 'wikidata-name' ? 'low' : /^https?:\/\//.test(source || '') ? 'high' : 'medium');
const person = (name, source, asOf) => (name ? { name, source: source || 'unknown', confidence: confidence(source), asOf: asOf || null } : null);
const clean = (o) => (o && Object.keys(o).length ? o : null);

/** Where a company's square icon (logos/<market>/<TICKER>.svg) comes from.
 *  generated: initials badge we draw; official: curated/logo-provenance.json names the owner's site, press kit or an official document;
 *  commons: Wikimedia Commons (logo-sources.json, or a curated entry of that type); crawled: TradingView's symbol-logo service, with no per-file check.
 *  Only evidence moves a logo out of "crawled", so the label never claims more than we know. */
export const PROVENANCE = ['official', 'commons', 'crawled', 'generated'];
const PROVENANCE_TYPES = { 'official-site': 'official', 'press-kit': 'official', 'official-document': 'official', 'wikimedia-commons': 'commons' };
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf-8')); } catch { return {}; } };
const CURATED_LOGOS = readJson('curated/logo-provenance.json');
const COMMONS_LOGOS = readJson('logo-sources.json');
for (const [key, v] of Object.entries(CURATED_LOGOS)) {
    if (!PROVENANCE_TYPES[v?.type]) throw new Error(`curated/logo-provenance.json ${key}: type must be one of ${Object.keys(PROVENANCE_TYPES).join(', ')}`);
    if (!/^https?:\/\//.test(v.source || '')) throw new Error(`curated/logo-provenance.json ${key}: source must be a URL`);
}
export function logoProvenance(marketKey, ticker, m) {
    if (m.isProcedural) return { provenance: 'generated', provenanceSource: null };
    for (const t of [ticker, m.logoOf].filter(Boolean)) {
        const key = `${marketKey.toUpperCase()}:${t}`;
        const c = CURATED_LOGOS[key];
        if (c) return { provenance: PROVENANCE_TYPES[c.type], provenanceSource: href(c.source) };
        if (COMMONS_LOGOS[key]?.commonsFile) return { provenance: 'commons', provenanceSource: href(COMMONS_LOGOS[key].commonsFile) };
    }
    return { provenance: 'crawled', provenanceSource: null };
}

const BRANDS = loadBrands();
const brandsOf = new Map();
for (const b of BRANDS) for (const owner of [b.parent, ...(b.otherListedOwners || [])]) {
    if (!brandsOf.has(owner)) brandsOf.set(owner, []);
    brandsOf.get(owner).push(b);
}

export function brandUrls(b) {
    return {
        url: `${CDN}/${b.logo}`,
        format: b.logo.endsWith('.svg') ? 'svg' : 'png',
        svg: b.logo.endsWith('.svg') ? `${CDN}/${b.logo}` : null,
        mark: b.mark ? `${CDN}/${b.mark}` : null,
        png: Object.fromEntries(brandPngSizes(b).map((s) => [s, `${CDN}/brands/png/${s}/${b.slug}.png`])),
    };
}

/** A source as a valid URL: non-ASCII characters percent-encoded, any note after the URL dropped. */
const href = (u) => { if (!u) return u ?? null; try { return new URL(String(u).trim().split(/\s/)[0]).href; } catch { return u; } };
const hrefs = (o) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, href(v)])) : null);
const companyUrl = (key) => { const [mk, t] = key.split(':'); return `${API_BASE}/companies/${mk.toLowerCase()}/${encodeURIComponent(t)}.json`; };

export function toBrand(b) {
    const [market, ticker] = b.parent.split(':');
    const owners = [b.parent, ...(b.otherListedOwners || [])].map((key, i) => {
        const [mk, t] = key.split(':');
        return { market: mk, ticker: t, role: i ? 'listed' : 'parent', url: companyUrl(key) };
    });
    return {
        slug: b.slug, name: b.name, aliases: b.aliases || [], kind: b.kind, category: b.category ?? null, description: b.description ?? null,
        founded: b.founded ?? null, country: b.country ?? null,
        parent: { market, ticker, url: companyUrl(b.parent) },
        otherListedOwners: b.otherListedOwners || [],
        owners, markets: [...new Set(owners.map((o) => o.market))],
        website: b.website ?? null, wikidata: b.wikidata ?? null, brandColor: b.brandColor ?? null, brandInk: brandInk(b.brandColor), onDark: !!b.onDark,
        logo: brandUrls(b),
        sources: { logo: href(b.logoSource), logoType: b.logoSourceType, ownership: href(b.ownershipSource), facts: hrefs(b.factSources), checkedAt: b.checkedAt ?? null },
        links: { self: `${API_BASE}/brands/${b.slug}.json` },
    };
}

const INSTITUTIONS = loadInstitutions();
const childrenOf = new Map();
const institutionOf = new Map();   // MARKET:TICKER -> the institution that is that listed company
for (const x of INSTITUTIONS) {
    if (x.parent && !/^[A-Z]+:/.test(x.parent)) { if (!childrenOf.has(x.parent)) childrenOf.set(x.parent, []); childrenOf.get(x.parent).push(x); }
    if (x.listedAs) institutionOf.set(x.listedAs, x);
}

export function toInstitution(x) {
    const isCompany = (v) => /^[A-Z]+:/.test(v || '');
    return {
        slug: x.slug, name: x.name, shortName: x.shortName ?? null, aliases: x.aliases || [], kind: x.kind, country: x.country, description: x.description ?? null,
        founded: x.founded ?? null, headquarters: x.headquarters ?? null, legalBasis: x.legalBasis ?? null,
        parent: x.parent ? (isCompany(x.parent) ? { company: x.parent, url: companyUrl(x.parent) } : { institution: x.parent, url: `${API_BASE}/institutions/${x.parent}.json` }) : null,
        children: (childrenOf.get(x.slug) || []).map((c) => ({ slug: c.slug, name: c.name, url: `${API_BASE}/institutions/${c.slug}.json` })).sort((a, b) => a.name.localeCompare(b.name, 'en')),
        listedAs: x.listedAs ? { company: x.listedAs, url: companyUrl(x.listedAs) } : null,
        website: x.website ?? null, wikidata: x.wikidata ?? null, brandColor: x.brandColor ?? null, brandInk: brandInk(x.brandColor), onDark: !!x.onDark,
        logo: {
            url: `${CDN}/${x.logo}`, format: x.logo.endsWith('.svg') ? 'svg' : 'png',
            svg: x.logo.endsWith('.svg') ? `${CDN}/${x.logo}` : null,
            mark: x.mark ? `${CDN}/${x.mark}` : null,
            png: Object.fromEntries(pngSizesOf(x).map((s) => [s, `${CDN}/institutions/png/${s}/${x.slug}.png`])),
        },
        usageNote: x.usageNote ?? null,
        sources: { logo: href(x.logoSource), logoType: x.logoSourceType, facts: hrefs(x.factSources), checkedAt: x.checkedAt ?? null },
        links: { self: `${API_BASE}/institutions/${x.slug}.json` },
    };
}

/** One small row per brand and institution, for a search box that covers both (companies are in search-index.json). */
export function toEntity(e, type) {
    return {
        type, id: e.slug, name: e.name, shortName: e.shortName ?? null, aliases: e.aliases, kind: e.kind,
        owner: type === 'brand' ? `${e.parent.market}:${e.parent.ticker}` : (e.parent?.company || e.parent?.institution || null),
        country: e.country ?? null, logo: e.logo.png['256'] || e.logo.url, onDark: e.onDark, url: e.links.self,
    };
}

export function toCompany(marketKey, ticker, m) {
    const src = m.sources || {};
    const pngs = m.pngPaths ? Object.fromEntries(Object.entries(m.pngPaths).map(([size, p]) => [size, `${CDN}/${p}`])) : null;
    return {
        ticker,
        market: marketKey.toUpperCase(),
        name: m.company,
        legalName: m.legalName ?? null,
        aliases: m.aliases || [],
        country: m.country ?? null,
        countryCode: m.countryCode ?? null,
        flag: m.flag ?? null,
        exchange: m.exchange ?? null,
        currency: m.currency ?? null,
        isin: m.isin ?? null,
        lei: m.lei ?? null,
        cik: m.cik ?? null,
        wikidata: m.wikidata ?? null,
        classification: { sector: m.sector ?? null, industry: m.industry ?? null },
        listing: {
            status: m.status || 'listed',
            delistedAt: m.delistedAt ?? null,
            successor: m.successor ? { company: m.successor, url: companyUrl(m.successor) } : null,
            source: m.sources?.status ?? null,
        },
        marketCap: m.marketCap
            ? { currency: m.capCurrency ?? null, local: m.marketCap, usd: m.marketCapUsd ?? null, inr: m.marketCapInr ?? null, asOf: m.freshness?.marketData ?? null }
            : null,
        profile: {
            website: m.website ?? null,
            founded: m.founded ?? null,
            listingDate: m.listingDate ?? null,
            headquarters: m.headquarters ?? null,
            headquartersLocal: m.headquartersLocal ?? null,
            address: m.address ?? null,
            addressLocal: m.addressLocal ?? null,
            employees: m.employees ?? null,
            ceo: person(m.ceo, src.ceo || 'wikidata', m.officersAsOf?.ceo),
            chairman: person(m.chairman, src.chairman, m.officersAsOf?.chairman),
            slogan: m.slogan ?? null,
        },
        logo: {
            svg: m.format === 'svg' ? `${CDN}/${m.path}` : null,
            file: { url: `${CDN}/${m.path}`, format: m.format },
            png: pngs,
            brandColor: m.brandColor ?? null,
            brandColorSource: m.brandColorSource ?? null,
            brandInk: brandInk(m.brandColor),
            isPlaceholder: !!m.isProcedural,
            ...logoProvenance(marketKey, ticker, m),
            hd: m.hdPath ? `${CDN}/${m.hdPath}` : null,
        },
        brands: (brandsOf.get(`${marketKey.toUpperCase()}:${ticker}`) || [])
            .map((b) => ({ slug: b.slug, name: b.name, kind: b.kind, logo: `${CDN}/${b.logo}`, png: `${CDN}/brands/png/256/${b.slug}.png`, url: `${API_BASE}/brands/${b.slug}.json` })),
        institution: institutionOf.has(`${marketKey.toUpperCase()}:${ticker}`)
            ? (({ slug, name }) => ({ slug, name, url: `${API_BASE}/institutions/${slug}.json` }))(institutionOf.get(`${marketKey.toUpperCase()}:${ticker}`))
            : null,
        links: {
            self: `${API_BASE}/companies/${marketKey}/${encodeURIComponent(ticker)}.json`,
            yahoo: m.yahooUrl ?? null,
            website: m.website ?? null,
        },
        sources: clean(src),
        checks: m.checks ?? null,
        freshness: { marketData: m.freshness?.marketData ?? null, profile: m.freshness?.profile ?? null },
    };
}

const nullable = (t, extra = {}) => ({ type: [t, 'null'], ...extra });
const INK = { type: ['object', 'null'], required: ['color', 'theme', 'contrast'], additionalProperties: false, description: 'A readable text colour for brandColor: WCAG AA (contrast >= 4.5) for normal text. theme is the theme of the tile that brandColor forms: dark = a dark tile with light ink, light = a light tile with dark ink. null when there is no brandColor.', properties: { color: { type: 'string', pattern: '^#[0-9A-F]{6}$' }, theme: { enum: ['light', 'dark'] }, contrast: { type: 'number', minimum: 4.5 } } };
const person_ = { type: ['object', 'null'], required: ['name', 'source', 'confidence', 'asOf'], properties: { name: { type: 'string' }, source: { type: 'string' }, asOf: nullable('string', { format: 'date', description: 'Date this name was last checked by hand against the source; null when no check date is recorded (never guessed)' }), confidence: { enum: ['low', 'medium', 'high'], description: 'low = community data that may be out of date (Wikidata); medium = exchange or registry data; high = checked by hand against the company\'s own page or filing (source is that URL)' } }, additionalProperties: false };
export const COMPANY_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${API_BASE}/schema/company.schema.json`,
    title: 'Company',
    description: 'One listed company: identity, classification, market cap, profile and logo. Unknown values are null, never guessed.',
    type: 'object',
    required: ['ticker', 'market', 'name', 'aliases', 'classification', 'listing', 'marketCap', 'profile', 'logo', 'links', 'freshness'],
    properties: {
        ticker: { type: 'string', description: 'Ticker as used in the logo file name' },
        market: { type: 'string', description: 'Upper-case market key, for example IN, US, KOREA' },
        name: { type: 'string' },
        legalName: nullable('string'),
        aliases: { type: 'array', items: { type: 'string' } },
        country: nullable('string'), countryCode: nullable('string', { pattern: '^[A-Z]{2}$' }), flag: nullable('string'),
        exchange: nullable('string'), currency: nullable('string', { description: 'Price currency; minor units such as GBX can differ from marketCap.currency' }),
        isin: nullable('string', { pattern: '^[A-Z]{2}[A-Z0-9]{9}[0-9]$' }),
        lei: nullable('string'), cik: nullable('string'), wikidata: nullable('string', { pattern: '^Q[0-9]+$' }),
        classification: { type: 'object', required: ['sector', 'industry'], properties: { sector: nullable('string'), industry: nullable('string') }, additionalProperties: false },
        listing: {
            type: 'object', required: ['status', 'delistedAt', 'successor', 'source'], additionalProperties: false,
            description: 'Whether the shares still trade. A delisted company (acquired, taken private, renamed to a new ticker) keeps its file; successor is the company that took it over or its new listing.',
            properties: {
                status: { enum: ['listed', 'delisted'] }, delistedAt: nullable('string', { format: 'date' }),
                successor: { type: ['object', 'null'], required: ['company', 'url'], properties: { company: { type: 'string', description: 'MARKET:TICKER' }, url: { type: 'string', format: 'uri' } }, additionalProperties: false },
                source: nullable('string', { format: 'uri' }),
            },
        },
        marketCap: {
            type: ['object', 'null'], required: ['currency', 'local', 'usd', 'inr', 'asOf'],
            properties: { currency: nullable('string', { description: 'Reporting currency of `local`' }), local: { type: 'number' }, usd: nullable('number', { description: 'Approximate: converted at the daily rate in fx-rates.json' }), inr: nullable('number'), asOf: nullable('string') },
            additionalProperties: false,
        },
        profile: {
            type: 'object',
            required: ['website', 'founded', 'listingDate', 'headquarters', 'headquartersLocal', 'address', 'addressLocal', 'employees', 'ceo', 'chairman', 'slogan'],
            properties: {
                website: nullable('string', { format: 'uri', description: 'Site root only' }),
                founded: nullable('integer'), listingDate: nullable('string', { format: 'date', description: 'First listing on an exchange, not the founding date' }),
                headquarters: nullable('string'), headquartersLocal: nullable('string'), address: nullable('string'), addressLocal: nullable('string'),
                employees: nullable('integer'), ceo: person_, chairman: person_, slogan: nullable('string'),
            },
            additionalProperties: false,
        },
        logo: {
            type: 'object', required: ['svg', 'file', 'png', 'brandColor', 'brandInk', 'brandColorSource', 'isPlaceholder', 'provenance', 'provenanceSource'],
            properties: {
                svg: nullable('string', { format: 'uri', description: 'Vector logo; null for the 107 older companies that only have a PNG (use `file`)' }),
                file: { type: 'object', required: ['url', 'format'], properties: { url: { type: 'string', format: 'uri' }, format: { enum: ['svg', 'png'] } }, additionalProperties: false, description: 'The logo file in the logos/ folder, always present' },
                png: { type: ['object', 'null'], description: 'PNG URLs by pixel size (64, 128, 256, 512); present for the 3,000 largest companies', additionalProperties: { type: 'string', format: 'uri' } },
                brandColor: nullable('string', { pattern: '^#[0-9A-F]{6}$', description: 'Taken from the logo file: an approximation, not an official brand colour' }),
                brandInk: INK, brandColorSource: nullable('string'), isPlaceholder: { type: 'boolean', description: 'true = generated initials badge, not a real logo' },
                provenance: { enum: PROVENANCE, description: 'Where the square icon comes from. official = the owner\'s site, press kit or an official document; commons = Wikimedia Commons; crawled = TradingView\'s symbol-logo service, not checked file by file; generated = initials badge. Show only official and commons when you need logos with a known source.' },
                provenanceSource: nullable('string', { format: 'uri', description: 'The page or file the logo was taken from; null for crawled and generated' }),
                hd: nullable('string', { format: 'uri', description: 'Official full logo (wordmark or lock-up, original aspect ratio): vector SVG, or an official PNG of at least 1,000 px when the company publishes no vector logo; `svg` is the square icon' }),
            },
            additionalProperties: false,
        },
        brands: {
            type: 'array', description: 'Brands, sub-brands and subsidiaries this company owns (see /brands.json)',
            items: { type: 'object', required: ['slug', 'name', 'kind', 'logo', 'png', 'url'], properties: { slug: { type: 'string' }, name: { type: 'string' }, kind: { enum: ['brand', 'subsidiary', 'product', 'service', 'app'] }, logo: { type: 'string', format: 'uri', description: 'The original logo file (SVG, or an official PNG)' }, png: { type: 'string', format: 'uri', description: '256 px PNG, always present' }, url: { type: 'string', format: 'uri' } }, additionalProperties: false },
        },
        institution: { type: ['object', 'null'], description: 'When this listed company is also a market institution (NSE, BSE, CDSL, MCX...): its institution record', required: ['slug', 'name', 'url'], properties: { slug: { type: 'string' }, name: { type: 'string' }, url: { type: 'string', format: 'uri' } }, additionalProperties: false },
        links: { type: 'object', required: ['self', 'yahoo', 'website'], properties: { self: { type: 'string', format: 'uri' }, yahoo: nullable('string'), website: nullable('string') }, additionalProperties: false },
        sources: { type: ['object', 'null'], description: 'Where each profile value came from', additionalProperties: { type: 'string' } },
        checks: { type: ['object', 'null'], description: 'A second source that disagreed with a value we hold' },
        freshness: { type: 'object', required: ['marketData', 'profile'], properties: { marketData: nullable('string'), profile: nullable('string') }, additionalProperties: false },
    },
    additionalProperties: false,
};

const uri = { type: 'string', format: 'uri' };
const facts_ = { type: ['object', 'null'], description: 'Source URL of each fact (founded, country, headquarters, legalBasis)', additionalProperties: uri };
const pngs_ = (sizes) => ({ type: 'object', description: `PNG URLs by pixel size (${sizes}); 256 and 512 always exist, larger sizes only when the original allows (a raster is never upscaled)`, required: ['256', '512'], additionalProperties: uri });
export const BRAND_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${API_BASE}/schema/brand.schema.json`,
    title: 'Brand',
    description: 'A consumer brand, sub-brand, product, app or subsidiary, linked to the listed company that ultimately owns it.',
    type: 'object',
    required: ['slug', 'name', 'aliases', 'kind', 'category', 'description', 'founded', 'country', 'parent', 'otherListedOwners', 'owners', 'markets', 'website', 'wikidata', 'brandColor', 'brandInk', 'onDark', 'logo', 'sources', 'links'],
    properties: {
        slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }, name: { type: 'string' },
        aliases: { type: 'array', items: { type: 'string' }, description: 'Other names people search for' },
        kind: { enum: ['brand', 'subsidiary', 'product', 'service', 'app'] },
        category: nullable('string'), description: nullable('string'),
        founded: nullable('integer', { description: 'Year the brand was launched' }),
        country: nullable('string', { pattern: '^[A-Z]{2}$', description: 'Country where the brand originated (ISO 3166 alpha-2)' }),
        parent: { type: 'object', description: 'The ultimate listed owner', required: ['market', 'ticker', 'url'], properties: { market: { type: 'string' }, ticker: { type: 'string' }, url: uri }, additionalProperties: false },
        otherListedOwners: { type: 'array', items: { type: 'string' }, description: 'Other listed group companies that own or sell it, as MARKET:TICKER' },
        owners: { type: 'array', description: 'parent first, then the other listed owners, with their API URLs', items: { type: 'object', required: ['market', 'ticker', 'role', 'url'], properties: { market: { type: 'string' }, ticker: { type: 'string' }, role: { enum: ['parent', 'listed'] }, url: uri }, additionalProperties: false } },
        markets: { type: 'array', items: { type: 'string' }, description: 'Markets of its listed owners, e.g. ["UK", "IN"] for Surf Excel' },
        website: nullable('string', { format: 'uri' }), wikidata: nullable('string', { pattern: '^Q[0-9]+$' }),
        brandColor: nullable('string', { pattern: '^#[0-9A-F]{6}$' }), brandInk: INK, onDark: { type: 'boolean', description: 'true = a light logo meant for dark backgrounds' },
        logo: {
            type: 'object', required: ['url', 'format', 'svg', 'mark', 'png'], additionalProperties: false,
            description: 'url is the original file: vector SVG, or an official PNG of at least 1,000 px when the brand publishes no vector logo',
            properties: { url: uri, format: { enum: ['svg', 'png'] }, svg: nullable('string', { format: 'uri' }), mark: nullable('string', { format: 'uri', description: 'Square symbol or app icon' }), png: pngs_('256, 512, 1024') },
        },
        sources: { type: 'object', required: ['logo', 'logoType', 'ownership', 'facts', 'checkedAt'], properties: { logo: uri, logoType: { type: 'string' }, ownership: nullable('string'), facts: facts_, checkedAt: nullable('string') }, additionalProperties: false },
        links: { type: 'object', required: ['self'], properties: { self: uri }, additionalProperties: false },
    },
    additionalProperties: false,
};
const ref_ = { type: 'object', required: ['slug', 'name', 'url'], properties: { slug: { type: 'string' }, name: { type: 'string' }, url: uri }, additionalProperties: false };
export const INSTITUTION_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${API_BASE}/schema/institution.schema.json`,
    title: 'Institution',
    description: 'A market institution: regulator, government body, exchange, depository, clearing corporation, payment system, rating agency or industry body.',
    type: 'object',
    required: ['slug', 'name', 'shortName', 'aliases', 'kind', 'country', 'description', 'founded', 'headquarters', 'legalBasis', 'parent', 'children', 'listedAs', 'website', 'wikidata', 'brandColor', 'brandInk', 'onDark', 'logo', 'usageNote', 'sources', 'links'],
    properties: {
        slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }, name: { type: 'string' }, shortName: nullable('string'),
        aliases: { type: 'array', items: { type: 'string' } },
        kind: { type: 'string' }, country: { type: 'string', pattern: '^[A-Z]{2}$' }, description: nullable('string'),
        founded: nullable('integer'), headquarters: nullable('string'), legalBasis: nullable('string', { description: 'The act, rules or order it was set up under' }),
        parent: { type: ['object', 'null'], properties: { institution: { type: 'string' }, company: { type: 'string' }, url: uri }, required: ['url'], additionalProperties: false },
        children: { type: 'array', description: 'Institutions whose parent this is (UPI, RuPay... for NPCI)', items: ref_ },
        listedAs: { type: ['object', 'null'], description: 'The catalogue company when the institution is itself listed', required: ['company', 'url'], properties: { company: { type: 'string' }, url: uri }, additionalProperties: false },
        website: nullable('string', { format: 'uri' }), wikidata: nullable('string', { pattern: '^Q[0-9]+$' }),
        brandColor: nullable('string', { pattern: '^#[0-9A-F]{6}$' }), brandInk: INK, onDark: { type: 'boolean' },
        logo: { type: 'object', required: ['url', 'format', 'svg', 'mark', 'png'], properties: { url: uri, format: { enum: ['svg', 'png'] }, svg: nullable('string', { format: 'uri' }), mark: nullable('string', { format: 'uri' }), png: pngs_('256, 512, 1024, 2048') }, additionalProperties: false },
        usageNote: nullable('string', { description: 'Legal restriction on the logo, e.g. the State Emblem of India' }),
        sources: { type: 'object', required: ['logo', 'logoType', 'facts', 'checkedAt'], properties: { logo: uri, logoType: { type: 'string' }, facts: facts_, checkedAt: nullable('string') }, additionalProperties: false },
        links: { type: 'object', required: ['self'], properties: { self: uri }, additionalProperties: false },
    },
    additionalProperties: false,
};
const listingRef_ = { type: 'object', required: ['market', 'ticker', 'exchange', 'status', 'url'], additionalProperties: false, properties: { market: { type: 'string' }, ticker: { type: 'string' }, exchange: nullable('string'), status: { enum: ['listed', 'delisted'] }, url: uri } };
export const ISIN_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${API_BASE}/schema/isin.schema.json`,
    title: 'ISIN pointer',
    description: 'Points an ISIN to the company file of its primary listing. Several lines can share an ISIN (a share and its depositary receipts or cross-listings in other markets): primary is the home-market listing that is still listed, then the largest by market cap; the rest are in others, in the same order.',
    type: 'object', required: ['isin', 'name', 'primary', 'others'],
    properties: { isin: { type: 'string', pattern: '^[A-Z]{2}[A-Z0-9]{9}[0-9]$' }, name: { type: 'string', description: 'Name of the primary listing' }, primary: listingRef_, others: { type: 'array', items: listingRef_ } },
    additionalProperties: false,
};
export const LOOKUP_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${API_BASE}/schema/lookup.schema.json`,
    title: 'Exchange lookup pointer',
    description: 'Points an exchange code and ticker, as in the file name (NASDAQ-AAPL, NSE-TCS, LSE-VOD), to the company file.',
    type: 'object', required: ['key', 'exchange', 'ticker', 'market', 'name', 'isin', 'status', 'url'],
    properties: { key: { type: 'string', description: 'EXCHANGE-TICKER, the file name without .json' }, exchange: { type: 'string' }, ticker: { type: 'string' }, market: { type: 'string' }, name: { type: 'string' }, isin: nullable('string', { pattern: '^[A-Z]{2}[A-Z0-9]{9}[0-9]$' }), status: { enum: ['listed', 'delisted'] }, url: uri },
    additionalProperties: false,
};
const ENTITY_SCHEMA = {
    type: 'object', required: ['type', 'id', 'name', 'shortName', 'aliases', 'kind', 'owner', 'country', 'logo', 'onDark', 'url'],
    properties: {
        type: { enum: ['brand', 'institution'] }, id: { type: 'string', description: 'The slug' }, name: { type: 'string' }, shortName: nullable('string'),
        aliases: { type: 'array', items: { type: 'string' } }, kind: { type: 'string' },
        owner: nullable('string', { description: 'Brand: MARKET:TICKER of its parent. Institution: its parent institution slug or company' }),
        country: nullable('string'), logo: { ...uri, description: '256 px PNG' }, onDark: { type: 'boolean' }, url: { ...uri, description: 'The full record' },
    },
    additionalProperties: false,
};

function openapi(counts) {
    const err = { description: 'Not found: the file does not exist (unknown market or ticker)' };
    return {
        openapi: '3.1.0',
        info: {
            title: 'Global Stock Logos API', version: manifest.version,
            description: `Static JSON API for ${counts.companies.toLocaleString()} listed companies in ${counts.markets} markets: logo, identity, market cap in local currency, USD and INR, and a company profile. Every endpoint is a plain file served by a CDN, so there are no keys, no rate limits of our own and no server. Unknown values are null. CEO and chairman carry a source and a confidence level because open data can be out of date.`,
            license: { name: 'MIT (code); logos belong to their owners, see DATA-SOURCES.md', url: 'https://github.com/MrChartist/global-stock-logos/blob/main/LICENSE' },
            contact: { name: '@MrChartist', url: 'https://mrchartist.com', email: 'contact@mrchartist.com' },
        },
        servers: [{ url: CDN, description: 'jsDelivr CDN (GitHub main)' }],
        externalDocs: { description: 'Guide and examples', url: 'https://github.com/MrChartist/global-stock-logos/blob/main/docs/API.md' },
        tags: [{ name: 'Catalogue' }, { name: 'Company' }, { name: 'Lookup' }, { name: 'Brand' }, { name: 'Institution' }],
        paths: {
            [`/api/${API_VERSION}/index.json`]: { get: { tags: ['Catalogue'], operationId: 'getIndex', summary: 'API root', responses: { 200: { description: 'Endpoints, counts and data freshness', content: { 'application/json': { schema: { $ref: '#/components/schemas/Index' } } } } } } },
            [`/api/${API_VERSION}/markets.json`]: { get: { tags: ['Catalogue'], operationId: 'listMarkets', summary: 'All markets', responses: { 200: { description: 'Markets, largest first', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Market' } } } } } } } },
            [`/api/${API_VERSION}/markets/{market}.json`]: { get: { tags: ['Catalogue'], operationId: 'getMarket', summary: 'Companies of one market, largest first', parameters: [{ name: 'market', in: 'path', required: true, schema: { type: 'string', examples: ['in', 'us', 'korea'] }, description: 'Lower-case market key from markets.json' }], responses: { 200: { description: 'Slim company rows', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CompanyRow' } } } } }, 404: err } } },
            [`/api/${API_VERSION}/companies/{market}/{ticker}.json`]: { get: { tags: ['Company'], operationId: 'getCompany', summary: 'Full profile of one company', parameters: [{ name: 'market', in: 'path', required: true, schema: { type: 'string' } }, { name: 'ticker', in: 'path', required: true, schema: { type: 'string', examples: ['TCS', 'AAPL'] }, description: 'Ticker as in the market list; URL-encode special characters' }], responses: { 200: { description: 'The company', content: { 'application/json': { schema: { $ref: '#/components/schemas/Company' } } } }, 404: err } } },
            [`/api/${API_VERSION}/isin/{isin}.json`]: { get: { tags: ['Lookup'], operationId: 'getIsin', summary: 'Find a company by ISIN', description: 'A pointer to the primary listing (home market, still listed, largest) and the other lines that share the ISIN. Follow primary.url for the full profile.', parameters: [{ name: 'isin', in: 'path', required: true, schema: { type: 'string', examples: ['US0378331005', 'INE467B01029'] }, description: 'Upper-case ISIN' }], responses: { 200: { description: 'The pointer', content: { 'application/json': { schema: { $ref: '#/components/schemas/IsinPointer' } } } }, 404: err } } },
            [`/api/${API_VERSION}/lookup/{key}.json`]: { get: { tags: ['Lookup'], operationId: 'getLookup', summary: 'Find a company by exchange code and ticker', description: 'The key is EXCHANGE-TICKER with the exchange code from the company file (NASDAQ-AAPL, NSE-TCS). Companies without an exchange code have no lookup file; use /companies/{market}/{ticker}.json.', parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string', examples: ['NASDAQ-AAPL', 'NSE-TCS'] }, description: 'Upper-case exchange code, a hyphen, then the ticker as in the market list' }], responses: { 200: { description: 'The pointer', content: { 'application/json': { schema: { $ref: '#/components/schemas/LookupPointer' } } } }, 404: err } } },
            [`/api/${API_VERSION}/brands.json`]: { get: { tags: ['Brand'], operationId: 'listBrands', summary: 'Every brand, sub-brand and subsidiary with its listed parent', responses: { 200: { description: 'Brands, by name', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Brand' } } } } } } } },
            [`/api/${API_VERSION}/institutions.json`]: { get: { tags: ['Institution'], operationId: 'listInstitutions', summary: 'Market institutions: regulators, governments, exchanges, depositories, clearing corporations, payment systems, rating agencies, industry bodies', responses: { 200: { description: 'Institutions, by name', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Institution' } } } } } } } },
            [`/api/${API_VERSION}/entities.json`]: { get: { tags: ['Catalogue'], operationId: 'listEntities', summary: 'Every brand and institution in one small index, for a search box', description: 'Companies are in /search-index.json; together the two cover everything with a logo.', responses: { 200: { description: 'Brands and institutions', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Entity' } } } } } } } },
            [`/api/${API_VERSION}/institutions/{slug}.json`]: { get: { tags: ['Institution'], operationId: 'getInstitution', summary: 'One institution', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string', examples: ['sebi', 'rbi', 'upi'] } }], responses: { 200: { description: 'The institution', content: { 'application/json': { schema: { $ref: '#/components/schemas/Institution' } } } }, 404: err } } },
            [`/api/${API_VERSION}/brands/{slug}.json`]: { get: { tags: ['Brand'], operationId: 'getBrand', summary: 'One brand', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string', examples: ['jio', 'instagram'] } }], responses: { 200: { description: 'The brand', content: { 'application/json': { schema: { $ref: '#/components/schemas/Brand' } } } }, 404: err } } },
            '/search-index-top.json': { get: { tags: ['Catalogue'], operationId: 'searchIndexTop', summary: 'The 2,000 largest companies in the same format, about 220 KB', description: 'Use it to render a first screen quickly, then load the full index.', responses: { 200: { description: 'The top of the index', content: { 'application/json': { schema: { type: 'array', items: { type: 'array' } } } } } } } },
            '/search-index.json': { get: { tags: ['Catalogue'], operationId: 'searchIndex', summary: 'Compact index of every company, for search boxes', description: 'Array of [ticker, name, market, format, yahooTicker, marketCapUsd]. Largest companies first; home-market listings ahead of depositary receipts.', responses: { 200: { description: 'The index', content: { 'application/json': { schema: { type: 'array', items: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: ['number', 'null'] }] } } } } } } } },
        },
        components: {
            schemas: {
                Index: { type: 'object', properties: { api: { type: 'string' }, version: { type: 'string' }, dataRefreshedAt: { type: 'string' }, companies: { type: 'integer' }, markets: { type: 'integer' }, endpoints: { type: 'object' }, cdn: { type: 'string' } } },
                Market: { type: 'object', required: ['key', 'code', 'country', 'companies', 'url'], properties: { key: { type: 'string' }, code: { type: 'string' }, country: { type: 'string' }, companies: { type: 'integer' }, url: { type: 'string', format: 'uri' } } },
                CompanyRow: { type: 'object', required: ['ticker', 'name'], properties: { ticker: { type: 'string' }, name: { type: 'string' }, sector: { type: ['string', 'null'] }, marketCapUsd: { type: ['number', 'null'] }, url: { type: 'string', format: 'uri' } } },
                Company: { ...COMPANY_SCHEMA, $schema: undefined, $id: undefined },
                Brand: { ...BRAND_SCHEMA, $schema: undefined, $id: undefined },
                Institution: { ...INSTITUTION_SCHEMA, $schema: undefined, $id: undefined },
                Entity: ENTITY_SCHEMA,
                IsinPointer: { ...ISIN_SCHEMA, $schema: undefined, $id: undefined },
                LookupPointer: { ...LOOKUP_SCHEMA, $schema: undefined, $id: undefined },
            },
        },
    };
}

if (process.argv[1] && process.argv[1].endsWith('build-api.js')) {
    fs.rmSync(path.join(ROOT, 'api'), { recursive: true, force: true });
    for (const d of ['markets', 'companies', 'schema', 'isin', 'lookup']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
    const write = (rel, data) => fs.writeFileSync(path.join(OUT, rel), JSON.stringify(data));

    const markets = [];
    let total = 0;       // real companies
    const provenanceTotals = {};
    const byIsin = new Map(), lookups = [];
    let aliasCount = 0;  // renamed / special-character tickers that reuse another company's logo (see curated/aliases.json)
    for (const f of fs.readdirSync(path.join(ROOT, 'manifests')).sort()) {
        const key = f.replace('.json', '');
        const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests', f), 'utf-8'));
        fs.mkdirSync(path.join(OUT, 'companies', key), { recursive: true });
        const rows = [];
        for (const [ticker, m] of Object.entries(items)) {
            const c = toCompany(key, ticker, m);
            fs.writeFileSync(path.join(OUT, 'companies', key, `${ticker}.json`), JSON.stringify(c));
            if (m.logoOf) { aliasCount++; continue; }   // an alias has its own company file but is not listed or counted as another company
            const ref = { market: c.market, ticker, exchange: c.exchange, status: c.listing.status, url: c.links.self };
            if (c.isin) {
                if (!byIsin.has(c.isin)) byIsin.set(c.isin, []);
                byIsin.get(c.isin).push({ ref, name: c.name, home: !!c.country && c.country === MARKETS[key]?.country, listed: c.listing.status === 'listed', cap: c.marketCap?.usd || 0 });
            }
            if (c.exchange) lookups.push({ key: `${c.exchange}-${ticker}`, exchange: c.exchange, ticker, market: c.market, name: c.name, isin: c.isin, status: c.listing.status, url: c.links.self });
            provenanceTotals[c.logo.provenance] = (provenanceTotals[c.logo.provenance] || 0) + 1;
            rows.push({ ticker, name: c.name, sector: c.classification.sector, marketCapUsd: c.marketCap?.usd ?? null, url: c.links.self });
            total++;
        }
        rows.sort((a, b) => (b.marketCapUsd || 0) - (a.marketCapUsd || 0));
        write(`markets/${key}.json`, rows);
        markets.push({ key, code: key.toUpperCase(), country: MARKETS[key]?.country || key, companies: rows.length, url: `${API_BASE}/markets/${key}.json` });
    }
    markets.sort((a, b) => b.companies - a.companies);
    // ISIN pointers. Duplicates are ordered deterministically: still listed, home market, larger market cap, then market and ticker.
    for (const [isin, list] of byIsin) {
        list.sort((a, b) => b.listed - a.listed || b.home - a.home || b.cap - a.cap || (a.ref.market < b.ref.market ? -1 : a.ref.market > b.ref.market ? 1 : 0) || (a.ref.ticker < b.ref.ticker ? -1 : a.ref.ticker > b.ref.ticker ? 1 : 0));
        write(`isin/${isin}.json`, { isin, name: list[0].name, primary: list[0].ref, others: list.slice(1).map((x) => x.ref) });
    }
    for (const l of lookups) write(`lookup/${l.key}.json`, l);
    fs.mkdirSync(path.join(OUT, 'brands'), { recursive: true });
    const brands = BRANDS.map(toBrand).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const b of brands) write(`brands/${b.slug}.json`, b);
    write('brands.json', brands);
    fs.mkdirSync(path.join(OUT, 'institutions'), { recursive: true });
    const institutions = INSTITUTIONS.map(toInstitution).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const x of institutions) write(`institutions/${x.slug}.json`, x);
    write('institutions.json', institutions);
    write('entities.json', [...brands.map((b) => toEntity(b, 'brand')), ...institutions.map((x) => toEntity(x, 'institution'))]);
    write('markets.json', markets);
    write('schema/company.schema.json', COMPANY_SCHEMA);
    write('schema/isin.schema.json', ISIN_SCHEMA);
    write('schema/lookup.schema.json', LOOKUP_SCHEMA);
    write('schema/brand.schema.json', BRAND_SCHEMA);
    write('schema/institution.schema.json', INSTITUTION_SCHEMA);
    const counts = { companies: total, markets: markets.length };
    const logoProvenanceCounts = Object.fromEntries(PROVENANCE.map((p) => [p, provenanceTotals[p] || 0]));
    write('openapi.json', openapi(counts));
    write('index.json', {
        api: 'Global Stock Logos API', version: API_VERSION, dataVersion: manifest.version,
        dataRefreshedAt: manifest.dataRefreshedAt, companies: total, logoProvenance: logoProvenanceCounts, aliases: aliasCount, isins: byIsin.size, lookups: lookups.length, markets: markets.length, brands: brands.length, institutions: institutions.length, cdn: CDN,
        endpoints: {
            markets: `${API_BASE}/markets.json`,
            market: `${API_BASE}/markets/{market}.json`,
            company: `${API_BASE}/companies/{market}/{ticker}.json`,
            isin: `${API_BASE}/isin/{isin}.json`,
            lookup: `${API_BASE}/lookup/{exchange}-{ticker}.json`,
            brands: `${API_BASE}/brands.json`,
            brand: `${API_BASE}/brands/{slug}.json`,
            institutions: `${API_BASE}/institutions.json`,
            institution: `${API_BASE}/institutions/{slug}.json`,
            entities: `${API_BASE}/entities.json`,
            searchIndex: `${CDN}/search-index.json`,
            searchIndexTop: `${CDN}/search-index-top.json`,
            schema: `${API_BASE}/schema/company.schema.json`,
            isinSchema: `${API_BASE}/schema/isin.schema.json`,
            lookupSchema: `${API_BASE}/schema/lookup.schema.json`,
            brandSchema: `${API_BASE}/schema/brand.schema.json`,
            institutionSchema: `${API_BASE}/schema/institution.schema.json`,
            openapi: `${API_BASE}/openapi.json`,
        },
        // Logo URLs a page can build from an id alone, without fetching JSON first. 256 and 512 always exist.
        logoTemplates: {
            company: `${CDN}/logos/{market}/{ticker}.svg`,
            companyPng: `${CDN}/png/{size}/{market}/{ticker}.png`,
            brandPng: `${CDN}/brands/png/{size}/{slug}.png`,
            institutionPng: `${CDN}/institutions/png/{size}/{slug}.png`,
        },
        docs: 'https://github.com/MrChartist/global-stock-logos/blob/main/docs/API.md',
    });
    console.log(`[api] ${total} companies + ${aliasCount} alias files, ${markets.length} markets, ${brands.length} brands, ${institutions.length} institutions -> api/${API_VERSION}/`);
}
