/**
 * Global Stock Logos: API client (zero dependencies, runs in browsers and Node 18+).
 *
 *   import { StockLogosClient } from './client.js';
 *   const api = new StockLogosClient();                 // jsDelivr CDN by default
 *   const tcs = await api.company('in', 'TCS');
 *   const hits = await api.search('tata', { market: 'in', limit: 10 });
 *   const all = await api.find('surf');                 // companies, brands and institutions together
 *   img.src = api.brandLogoUrl('jio', 512);             // no fetch needed
 *
 * Every method reads a static JSON file (see docs/API.md). Results are cached in memory.
 */

export const DEFAULT_BASE_URL = 'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main';

/**
 * @typedef {{ name: string, source: string, confidence: 'low' | 'medium' | 'high' }} Person
 * @typedef {{
 *   ticker: string, market: string, name: string, legalName: string | null, aliases: string[],
 *   country: string | null, countryCode: string | null, flag: string | null, exchange: string | null,
 *   currency: string | null, isin: string | null, lei: string | null, cik: string | null, wikidata: string | null,
 *   classification: { sector: string | null, industry: string | null },
 *   marketCap: { currency: string | null, local: number, usd: number | null, inr: number | null, asOf: string | null } | null,
 *   profile: {
 *     website: string | null, founded: number | null, listingDate: string | null,
 *     headquarters: string | null, headquartersLocal: string | null, address: string | null, addressLocal: string | null,
 *     employees: number | null, ceo: Person | null, chairman: Person | null, slogan: string | null
 *   },
 *   logo: { svg: string | null, file: { url: string, format: 'svg' | 'png' }, png: Record<string, string> | null, brandColor: string | null, brandColorSource: string | null, isPlaceholder: boolean, hd?: string | null },
 *   brands?: BrandRef[], institution?: { slug: string, name: string, url: string } | null,
 *   links: { self: string, yahoo: string | null, website: string | null },
 *   sources: Record<string, string> | null, checks: Record<string, unknown> | null,
 *   freshness: { marketData: string | null, profile: string | null }
 * }} Company
 * @typedef {{ slug: string, name: string, kind: BrandKind, logo: string, png: string, url: string }} BrandRef
 * @typedef {'brand' | 'subsidiary' | 'product' | 'service' | 'app'} BrandKind
 * @typedef {{
 *   slug: string, name: string, aliases: string[], kind: BrandKind, category: string | null, description: string | null,
 *   founded: number | null, country: string | null,
 *   parent: { market: string, ticker: string, url: string }, otherListedOwners: string[],
 *   owners: { market: string, ticker: string, role: 'parent' | 'listed', url: string }[], markets: string[],
 *   website: string | null, wikidata: string | null, brandColor: string | null, onDark: boolean,
 *   logo: { url: string, format: 'svg' | 'png', svg: string | null, mark: string | null, png: Record<string, string> },
 *   sources: { logo: string, logoType: string, ownership: string | null, facts: Record<string, string> | null, checkedAt: string | null },
 *   links: { self: string }
 * }} Brand
 * @typedef {{
 *   slug: string, name: string, shortName: string | null, aliases: string[], kind: string, country: string, description: string | null,
 *   founded: number | null, headquarters: string | null, legalBasis: string | null,
 *   parent: { institution?: string, company?: string, url: string } | null,
 *   children: { slug: string, name: string, url: string }[], listedAs: { company: string, url: string } | null,
 *   website: string | null, wikidata: string | null, brandColor: string | null, onDark: boolean,
 *   logo: { url: string, format: 'svg' | 'png', svg: string | null, mark: string | null, png: Record<string, string> },
 *   usageNote: string | null, sources: { logo: string, logoType: string, facts: Record<string, string> | null, checkedAt: string | null },
 *   links: { self: string }
 * }} Institution
 * @typedef {{
 *   type: 'brand' | 'institution', id: string, name: string, shortName: string | null, aliases: string[], kind: string,
 *   owner: string | null, country: string | null, logo: string, onDark: boolean, url: string
 * }} Entity
 * @typedef {{ type: 'company', id: string, name: string, market: string, ticker: string, logo: string, url: string, hit: SearchHit }} CompanyResult
 * @typedef {CompanyResult | Entity} FindResult
 * @typedef {{ ticker: string, name: string, sector: string | null, marketCapUsd: number | null, url: string }} CompanyRow
 * @typedef {{ key: string, code: string, country: string, companies: number, url: string }} Market
 * @typedef {{ ticker: string, name: string, market: string, format: 'svg' | 'png', marketCapUsd: number | null, yahooTicker: string }} SearchHit
 * @typedef {{ api: string, version: string, dataVersion: string, dataRefreshedAt: string, companies: number, markets: number, cdn: string, endpoints: Record<string, string>, docs: string }} ApiIndex
 */

export class ApiError extends Error {
    /** @param {string} message @param {number} status @param {string} url */
    constructor(message, status, url) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.url = url;
    }
}

/** @param {unknown} s */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

export class StockLogosClient {
    /**
     * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
     *   baseUrl: where api/ and logos/ live (default: the jsDelivr CDN). Use '' or a path for a self-hosted copy.
     */
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
        this._fetch = options.fetch ?? ((...a) => globalThis.fetch(...a));
        /** @type {Map<string, Promise<any>>} */
        this._cache = new Map();
    }

    /** @param {string} path @returns {Promise<any>} */
    _json(path) {
        const url = `${this.baseUrl}/${path}`;
        const cached = this._cache.get(url);
        if (cached) return cached;
        /** @type {Promise<any>} */
        const p = this._fetch(url).then(async (res) => {
            if (!res.ok) throw new ApiError(`${res.status} for ${url}`, res.status, url);
            return res.json();
        });
        p.catch(() => this._cache.delete(url)); // do not cache failures
        this._cache.set(url, p);
        return p;
    }

    /** API root: version, counts, data freshness and endpoint templates. @returns {Promise<ApiIndex>} */
    index() { return this._json('api/v1/index.json'); }

    /** Every brand, sub-brand and subsidiary with its listed parent, by name. @returns {Promise<Brand[]>} */
    brands() { return this._json('api/v1/brands.json'); }

    /** One brand by slug, e.g. 'jio' or 'instagram'. @param {string} slug @returns {Promise<Brand>} */
    brand(slug) { return this._json(`api/v1/brands/${encodeURIComponent(slug.toLowerCase())}.json`); }

    /** Market institutions (regulators, governments, exchanges, depositories, payment systems...), by name. @returns {Promise<Institution[]>} */
    institutions() { return this._json('api/v1/institutions.json'); }

    /** One institution by slug, e.g. 'sebi', 'rbi' or 'upi'. @param {string} slug @returns {Promise<Institution>} */
    institution(slug) { return this._json(`api/v1/institutions/${encodeURIComponent(slug.toLowerCase())}.json`); }

    /** Every brand and institution as one small search index (companies are in searchRows()). @returns {Promise<Entity[]>} */
    entities() { return this._json('api/v1/entities.json'); }

    /**
     * One search across companies, brands and institutions, e.g. find('surf') → Surf Excel (brand) and Hindustan Unilever.
     * Ranking within each type: exact name or alias, prefix, word prefix, contains; brands and institutions come before
     * companies with the same score, because a name like "UPI" or "Jio" means the brand.
     * @param {string} query
     * @param {{ types?: ('company' | 'brand' | 'institution')[], limit?: number, market?: string }} [options]
     * @returns {Promise<FindResult[]>}
     */
    async find(query, { types = ['company', 'brand', 'institution'], limit = 20, market } = {}) {
        const q = norm(query).trim();
        if (!q) return [];
        /** @param {string[]} names */
        const rank = (names) => {
            let best = -1;
            for (const raw of names) {
                const n = norm(raw);
                if (!n) continue;
                const sc = n === q ? 0 : n.startsWith(q) ? 2 : n.includes(` ${q}`) ? 3 : n.includes(q) ? 4 : -1;
                if (sc >= 0 && (best < 0 || sc < best)) best = sc;
            }
            return best;
        };
        /** @type {{ r: FindResult, score: number }[]} */
        const out = [];
        if (types.includes('brand') || types.includes('institution')) {
            for (const e of await this.entities()) {
                if (!types.includes(e.type)) continue;
                const score = rank([e.name, e.shortName || '', ...e.aliases]);
                if (score >= 0) out.push({ r: e, score });
            }
        }
        if (types.includes('company')) {
            for (const h of await this.search(query, { market, limit })) {
                const exact = norm(h.ticker) === q || norm(h.name) === q;
                out.push({
                    r: { type: 'company', id: `${h.market}:${h.ticker}`, name: h.name, market: h.market, ticker: h.ticker, logo: this.logoOf(h), url: `${this.baseUrl}/api/v1/companies/${encodeURIComponent(h.market.toLowerCase())}/${encodeURIComponent(h.ticker)}.json`, hit: h },
                    score: exact ? 0.5 : 2.5,
                });
            }
        }
        return out.sort((a, b) => a.score - b.score).slice(0, limit).map((x) => x.r);
    }

    /** Brands a company owns or sells (from its profile). @param {string} market @param {string} ticker @returns {Promise<BrandRef[]>} */
    async brandsOf(market, ticker) { return (await this.company(market, ticker)).brands || []; }

    /** PNG of a brand's logo; 256 and 512 always exist, 1024 for vector logos and large originals. @param {string} slug @param {256 | 512 | 1024} [size] */
    brandLogoUrl(slug, size = 256) { return `${this.baseUrl}/brands/png/${size}/${encodeURIComponent(slug.toLowerCase())}.png`; }

    /** PNG of an institution's logo; 256 and 512 always exist, up to 2048 for vector logos. @param {string} slug @param {256 | 512 | 1024 | 2048} [size] */
    institutionLogoUrl(slug, size = 256) { return `${this.baseUrl}/institutions/png/${size}/${encodeURIComponent(slug.toLowerCase())}.png`; }

    /** All markets, largest first. @returns {Promise<Market[]>} */
    markets() { return this._json('api/v1/markets.json'); }

    /** Companies of one market, largest first. @param {string} market @returns {Promise<CompanyRow[]>} */
    market(market) { return this._json(`api/v1/markets/${encodeURIComponent(market.toLowerCase())}.json`); }

    /** Full profile of one company. @param {string} market @param {string} ticker @returns {Promise<Company>} */
    company(market, ticker) {
        return this._json(`api/v1/companies/${encodeURIComponent(market.toLowerCase())}/${encodeURIComponent(ticker)}.json`);
    }

    /**
     * The compact index as raw rows, exactly as stored: [ticker, name, market, format, yahooTicker, marketCapUsd].
     * Cheaper than searchIndex() because no objects are built; use it for large scans.
     * @returns {Promise<[string, string, string, 'svg' | 'png', string, number | null][]>}
     */
    searchRows() { return this._json('search-index.json'); }

    /**
     * The 2,000 largest companies as raw rows (about 220 KB), for a fast first screen. Same format as searchRows().
     * @returns {Promise<[string, string, string, 'svg' | 'png', string, number | null][]>}
     */
    topRows() { return this._json('search-index-top.json'); }

    /** @param {[string, string, string, 'svg' | 'png', string, number | null]} r @returns {SearchHit} */
    static hit(r) {
        return { ticker: r[0], name: r[1], market: r[2], format: r[3], yahooTicker: r[4], marketCapUsd: r[5] ?? null };
    }

    /** Compact index of every company as objects. @returns {Promise<SearchHit[]>} */
    async searchIndex() { return (await this.searchRows()).map(StockLogosClient.hit); }

    /**
     * Search by ticker or name. Ranking: exact ticker, ticker prefix, name starts with the query, word prefix, contains.
     * Ties keep the index order (largest companies first).
     * @param {string} query
     * @param {{ market?: string, limit?: number }} [options]
     * @returns {Promise<SearchHit[]>}
     */
    async search(query, { market, limit = 50 } = {}) {
        const q = norm(query).trim();
        if (!q) return [];
        const m = market ? market.toUpperCase() : null;
        const hits = [];
        for (const row of await this.searchRows()) {
            if (m && row[2] !== m) continue;
            const t = norm(row[0]), n = norm(row[1]);
            const score = t === q ? 0 : t.startsWith(q) ? 1 : n.startsWith(q) ? 2 : n.includes(` ${q}`) ? 3 : n.includes(q) ? 4 : -1;
            if (score >= 0) hits.push({ row, score });
        }
        // Stable sort by score keeps the largest-first order inside each score.
        return hits.sort((a, b) => a.score - b.score).slice(0, limit).map((h) => StockLogosClient.hit(h.row));
    }

    /**
     * URL of a logo file.
     *   'svg' (default): the vector logo, which exists for all but 107 older companies;
     *   'png': a rendered PNG of the given size, which exists for the 3,000 largest companies;
     *   'original-png': the older PNG in logos/, for the 107 companies that have no SVG (see `format` in search results).
     * @param {string} market @param {string} ticker
     * @param {{ format?: 'svg' | 'png' | 'original-png', size?: 64 | 128 | 256 | 512 }} [options]
     */
    logoUrl(market, ticker, { format = 'svg', size = 256 } = {}) {
        const m = encodeURIComponent(market.toLowerCase()), t = encodeURIComponent(ticker);
        if (format === 'png') return `${this.baseUrl}/png/${size}/${m}/${t}.png`;
        return `${this.baseUrl}/logos/${m}/${t}.${format === 'original-png' ? 'png' : 'svg'}`;
    }

    /**
     * URL of whichever logo file a search result actually has (SVG, or the older PNG).
     * @param {Pick<SearchHit, 'market' | 'ticker' | 'format'>} hit
     */
    logoOf(hit) {
        return this.logoUrl(hit.market, hit.ticker, { format: hit.format === 'png' ? 'original-png' : 'svg' });
    }
}
