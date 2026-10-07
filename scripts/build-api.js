/**
 * build-api.js — Build the static JSON API (api/v1/) from the manifests.
 *
 *   api/v1/index.json                          API root: version, endpoints, counts, freshness
 *   api/v1/markets.json                        every market with country, currency, company count
 *   api/v1/markets/<market>.json               slim list of the market's companies, largest first
 *   api/v1/companies/<market>/<TICKER>.json    the full profile of one company
 *   api/v1/schema/company.schema.json          JSON Schema of a company
 *   api/v1/openapi.json                        OpenAPI 3.1 description of all of the above
 *
 * Everything is a plain file, so it is served by jsDelivr or GitHub Pages with no server.
 * Run after sync.js:  node scripts/build-api.js
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from './enrich-store.js';
import { MARKETS } from './markets.js';

export const API_VERSION = 'v1';
const OUT = path.join(ROOT, 'api', API_VERSION);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'logos-manifest.json'), 'utf-8'));
const CDN = manifest.cdnBase.replace(/\/logos$/, '');
const API_BASE = `${CDN}/api/${API_VERSION}`;

/** Wikidata officers can be years out of date; exchange and registry officers are kept by a vendor. */
const confidence = (source) => (source === 'wikidata' || source === 'wikidata-name' ? 'low' : 'medium');
const person = (name, source, since = null) => (name ? { name, source: source || 'unknown', confidence: confidence(source), since } : null);
const clean = (o) => (o && Object.keys(o).length ? o : null);

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
            // ceoSince comes from Wikidata or a curated override; it never belongs to an exchange-sourced name.
            ceo: person(m.ceo, src.ceo || 'wikidata', !src.ceo || src.ceo === 'curated' || /^wikidata/.test(src.ceo) ? m.ceoSince ?? null : null),
            chairman: person(m.chairman, src.chairman),
            slogan: m.slogan ?? null,
        },
        logo: {
            svg: m.format === 'svg' ? `${CDN}/${m.path}` : null,
            file: { url: `${CDN}/${m.path}`, format: m.format },
            png: pngs,
            brandColor: m.brandColor ?? null,
            brandColorSource: m.brandColorSource ?? null,
            isPlaceholder: !!m.isProcedural,
        },
        secondaryListing: !!m.secondaryListing,
        aliasOf: m.logoOf ?? null,
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

const person_ = { type: ['object', 'null'], required: ['name', 'source', 'confidence', 'since'], properties: { name: { type: 'string' }, source: { type: 'string' }, confidence: { enum: ['low', 'medium'], description: 'low = community data that may be out of date (Wikidata); medium = exchange, registry or curated data' }, since: { type: ['string', 'null'], format: 'date', description: 'Start of the term when the source records it; null = unknown, so verify before use' } }, additionalProperties: false };
const nullable = (t, extra = {}) => ({ type: [t, 'null'], ...extra });
export const COMPANY_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${API_BASE}/schema/company.schema.json`,
    title: 'Company',
    description: 'One listed company: identity, classification, market cap, profile and logo. Unknown values are null, never guessed.',
    type: 'object',
    required: ['ticker', 'market', 'name', 'aliases', 'classification', 'marketCap', 'profile', 'logo', 'secondaryListing', 'aliasOf', 'links', 'freshness'],
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
            type: 'object', required: ['svg', 'file', 'png', 'brandColor', 'brandColorSource', 'isPlaceholder'],
            properties: {
                svg: nullable('string', { format: 'uri', description: 'Vector logo; null for the few older companies that only have a PNG (use `file`)' }),
                file: { type: 'object', required: ['url', 'format'], properties: { url: { type: 'string', format: 'uri' }, format: { enum: ['svg', 'png'] } }, additionalProperties: false, description: 'The logo file in the logos/ folder, always present' },
                png: { type: ['object', 'null'], description: 'PNG URLs by pixel size (64, 128, 256, 512); present for the 3,000 largest companies', additionalProperties: { type: 'string', format: 'uri' } },
                brandColor: nullable('string', { pattern: '^#[0-9A-F]{6}$', description: 'Taken from the logo file: an approximation, not an official brand colour' }),
                brandColorSource: nullable('string'), isPlaceholder: { type: 'boolean', description: 'true = generated initials badge, not a real logo' },
            },
            additionalProperties: false,
        },
        secondaryListing: { type: 'boolean', description: 'true = a copy of a company whose main listing is elsewhere (depositary receipt, CEDEAR, BDR, cross-listing); it ranks below main listings' },
        aliasOf: nullable('string', { description: 'Set on an exchange spelling or former ticker (M&M, ZOMATO): the ticker whose company file and logo this one repeats' }),
        links: { type: 'object', required: ['self', 'yahoo', 'website'], properties: { self: { type: 'string', format: 'uri' }, yahoo: nullable('string'), website: nullable('string') }, additionalProperties: false },
        sources: { type: ['object', 'null'], description: 'Where each profile value came from', additionalProperties: { type: 'string' } },
        checks: { type: ['object', 'null'], description: 'A second source that disagreed with a value we hold' },
        freshness: { type: 'object', required: ['marketData', 'profile'], properties: { marketData: nullable('string'), profile: nullable('string') }, additionalProperties: false },
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
        tags: [{ name: 'Catalogue' }, { name: 'Company' }],
        paths: {
            [`/api/${API_VERSION}/index.json`]: { get: { tags: ['Catalogue'], operationId: 'getIndex', summary: 'API root', responses: { 200: { description: 'Endpoints, counts and data freshness', content: { 'application/json': { schema: { $ref: '#/components/schemas/Index' } } } } } } },
            [`/api/${API_VERSION}/markets.json`]: { get: { tags: ['Catalogue'], operationId: 'listMarkets', summary: 'All markets', responses: { 200: { description: 'Markets, largest first', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Market' } } } } } } } },
            [`/api/${API_VERSION}/markets/{market}.json`]: { get: { tags: ['Catalogue'], operationId: 'getMarket', summary: 'Companies of one market: main listings largest first, then secondary listings', parameters: [{ name: 'market', in: 'path', required: true, schema: { type: 'string', examples: ['in', 'us', 'korea'] }, description: 'Lower-case market key from markets.json' }], responses: { 200: { description: 'Slim company rows', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CompanyRow' } } } } }, 404: err } } },
            [`/api/${API_VERSION}/companies/{market}/{ticker}.json`]: { get: { tags: ['Company'], operationId: 'getCompany', summary: 'Full profile of one company', parameters: [{ name: 'market', in: 'path', required: true, schema: { type: 'string' } }, { name: 'ticker', in: 'path', required: true, schema: { type: 'string', examples: ['TCS', 'AAPL'] }, description: 'Ticker as in the market list; URL-encode special characters' }], responses: { 200: { description: 'The company', content: { 'application/json': { schema: { $ref: '#/components/schemas/Company' } } } }, 404: err } } },
            '/search-index-top.json': { get: { tags: ['Catalogue'], operationId: 'searchIndexTop', summary: 'The 2,000 largest companies in the same format, about 220 KB', description: 'Use it to render a first screen quickly, then load the full index.', responses: { 200: { description: 'The top of the index', content: { 'application/json': { schema: { type: 'array', items: { type: 'array' } } } } } } } },
            '/search-index.json': { get: { tags: ['Catalogue'], operationId: 'searchIndex', summary: 'Compact index of every company, for search boxes', description: 'Array of [ticker, name, market, format, yahooTicker, marketCapUsd, flags, otherTickers?]. flags is a bit set: 1 = secondary listing (a copy of a company listed elsewhere), 2 = generated badge, not the real logo, 4 = listed in the home country of the company. otherTickers, present only when there are any, lists exchange spellings and former tickers that point at the same company (M&M, ZOMATO). Main listings first, largest first.', responses: { 200: { description: 'The index', content: { 'application/json': { schema: { type: 'array', items: { type: 'array', minItems: 7, prefixItems: [{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: ['number', 'null'] }, { type: 'integer' }, { type: 'array', items: { type: 'string' } }] } } } } } } } },
        },
        components: {
            schemas: {
                Index: { type: 'object', properties: { api: { type: 'string' }, version: { type: 'string' }, dataRefreshedAt: { type: 'string' }, companies: { type: 'integer' }, markets: { type: 'integer' }, endpoints: { type: 'object' }, cdn: { type: 'string' } } },
                Market: { type: 'object', required: ['key', 'code', 'country', 'companies', 'url'], properties: { key: { type: 'string' }, code: { type: 'string' }, country: { type: 'string' }, companies: { type: 'integer' }, url: { type: 'string', format: 'uri' } } },
                CompanyRow: { type: 'object', required: ['ticker', 'name'], properties: { ticker: { type: 'string' }, name: { type: 'string' }, sector: { type: ['string', 'null'] }, marketCapUsd: { type: ['number', 'null'] }, secondaryListing: { type: 'boolean', description: 'A copy of a company listed elsewhere; these rows follow the main listings' }, url: { type: 'string', format: 'uri' } } },
                Company: { ...COMPANY_SCHEMA, $schema: undefined, $id: undefined },
            },
        },
    };
}

if (process.argv[1] && process.argv[1].endsWith('build-api.js')) {
    fs.rmSync(path.join(ROOT, 'api'), { recursive: true, force: true });
    for (const d of ['markets', 'companies', 'schema']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
    const write = (rel, data) => fs.writeFileSync(path.join(OUT, rel), JSON.stringify(data));

    const markets = [];
    let total = 0;       // real companies
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
            rows.push({ ticker, name: c.name, sector: c.classification.sector, marketCapUsd: c.marketCap?.usd ?? null, secondaryListing: c.secondaryListing, url: c.links.self });
            total++;
        }
        // Main listings first, then copies of companies listed elsewhere; largest first within each (as in the search index).
        rows.sort((a, b) => a.secondaryListing - b.secondaryListing || (b.marketCapUsd || 0) - (a.marketCapUsd || 0));
        write(`markets/${key}.json`, rows);
        markets.push({ key, code: key.toUpperCase(), country: MARKETS[key]?.country || key, companies: rows.length, url: `${API_BASE}/markets/${key}.json` });
    }
    markets.sort((a, b) => b.companies - a.companies);
    write('markets.json', markets);
    write('schema/company.schema.json', COMPANY_SCHEMA);
    const counts = { companies: total, markets: markets.length };
    write('openapi.json', openapi(counts));
    write('index.json', {
        api: 'Global Stock Logos API', version: API_VERSION, dataVersion: manifest.version,
        dataRefreshedAt: manifest.dataRefreshedAt, companies: total, aliases: aliasCount, markets: markets.length, cdn: CDN,
        endpoints: {
            markets: `${API_BASE}/markets.json`,
            market: `${API_BASE}/markets/{market}.json`,
            company: `${API_BASE}/companies/{market}/{ticker}.json`,
            searchIndex: `${CDN}/search-index.json`,
            searchIndexTop: `${CDN}/search-index-top.json`,
            schema: `${API_BASE}/schema/company.schema.json`,
            openapi: `${API_BASE}/openapi.json`,
        },
        docs: 'https://github.com/MrChartist/global-stock-logos/blob/main/docs/API.md',
    });
    console.log(`[api] ${total} companies + ${aliasCount} alias files, ${markets.length} markets -> api/${API_VERSION}/`);
}
