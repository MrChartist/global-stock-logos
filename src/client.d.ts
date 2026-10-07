/**
 * Global Stock Logos: API client (zero dependencies, runs in browsers and Node 18+).
 *
 *   import { StockLogosClient } from './client.js';
 *   const api = new StockLogosClient();                 // jsDelivr CDN by default
 *   const tcs = await api.company('in', 'TCS');
 *   const hits = await api.search('tata', { market: 'in', limit: 10 });
 *
 * Every method reads a static JSON file (see docs/API.md). Results are cached in memory.
 */
export declare const DEFAULT_BASE_URL = "https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main";
export type Person = {
    name: string;
    source: string;
    confidence: 'low' | 'medium';
    since: string | null;
};
export type Company = {
    ticker: string;
    market: string;
    name: string;
    legalName: string | null;
    aliases: string[];
    country: string | null;
    countryCode: string | null;
    flag: string | null;
    exchange: string | null;
    currency: string | null;
    isin: string | null;
    lei: string | null;
    cik: string | null;
    wikidata: string | null;
    classification: {
        sector: string | null;
        industry: string | null;
    };
    marketCap: {
        currency: string | null;
        local: number;
        usd: number | null;
        inr: number | null;
        asOf: string | null;
    } | null;
    profile: {
        website: string | null;
        founded: number | null;
        listingDate: string | null;
        headquarters: string | null;
        headquartersLocal: string | null;
        address: string | null;
        addressLocal: string | null;
        employees: number | null;
        ceo: Person | null;
        chairman: Person | null;
        slogan: string | null;
    };
    logo: {
        svg: string | null;
        file: {
            url: string;
            format: 'svg' | 'png';
        };
        png: Record<string, string> | null;
        brandColor: string | null;
        brandColorSource: string | null;
        isPlaceholder: boolean;
    };
    secondaryListing: boolean;
    links: {
        self: string;
        yahoo: string | null;
        website: string | null;
    };
    sources: Record<string, string> | null;
    checks: Record<string, unknown> | null;
    freshness: {
        marketData: string | null;
        profile: string | null;
    };
};
export type CompanyRow = {
    ticker: string;
    name: string;
    sector: string | null;
    marketCapUsd: number | null;
    secondaryListing: boolean;
    url: string;
};
export type Market = {
    key: string;
    code: string;
    country: string;
    companies: number;
    url: string;
};
export type SearchHit = {
    ticker: string;
    name: string;
    market: string;
    format: 'svg' | 'png';
    marketCapUsd: number | null;
    yahooTicker: string;
    secondaryListing: boolean;
    isPlaceholder: boolean;
    homeListing: boolean;
    otherTickers: string[];
};
export type IndexRow = [string, string, string, 'svg' | 'png', string, number | null, number?, string[]?];
export type ApiIndex = {
    api: string;
    version: string;
    dataVersion: string;
    dataRefreshedAt: string;
    companies: number;
    aliases: number;
    markets: number;
    cdn: string;
    endpoints: Record<string, string>;
    docs: string;
};
/**
 * @typedef {{ name: string, source: string, confidence: 'low' | 'medium', since: string | null }} Person
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
 *   logo: { svg: string | null, file: { url: string, format: 'svg' | 'png' }, png: Record<string, string> | null, brandColor: string | null, brandColorSource: string | null, isPlaceholder: boolean },
 *   secondaryListing: boolean,
 *   links: { self: string, yahoo: string | null, website: string | null },
 *   sources: Record<string, string> | null, checks: Record<string, unknown> | null,
 *   freshness: { marketData: string | null, profile: string | null }
 * }} Company
 * @typedef {{ ticker: string, name: string, sector: string | null, marketCapUsd: number | null, secondaryListing: boolean, url: string }} CompanyRow
 * @typedef {{ key: string, code: string, country: string, companies: number, url: string }} Market
 * @typedef {{ ticker: string, name: string, market: string, format: 'svg' | 'png', marketCapUsd: number | null, yahooTicker: string, secondaryListing: boolean, isPlaceholder: boolean, homeListing: boolean, otherTickers: string[] }} SearchHit
 * @typedef {[string, string, string, 'svg' | 'png', string, number | null, number?, string[]?]} IndexRow
 *   [ticker, name, market, format, yahooTicker, marketCapUsd, flags, otherTickers?];
 *   flags: 1 secondary listing, 2 generated badge, 4 listed in the company's own country
 * @typedef {{ api: string, version: string, dataVersion: string, dataRefreshedAt: string, companies: number, aliases: number, markets: number, cdn: string, endpoints: Record<string, string>, docs: string }} ApiIndex
 */
export declare class ApiError extends Error {
    status: number;
    url: string;
    /** @param {string} message @param {number} status @param {string} url */
    constructor(message: string, status: number, url: string);
}
/**
 * Rank index rows for a query. Tiers: exact ticker (also an exchange spelling or former ticker such as M&M or ZOMATO);
 * ticker or name starts with the query; a word of the name starts with it; the name contains it.
 * A secondary listing (a copy of a company listed elsewhere) drops one tier. Inside a tier the larger company comes
 * first; between listings of about the same size (one company in several markets) the home-country listing wins.
 * @param {IndexRow[]} rows @param {string} query @param {{ market?: string | null }} [options]
 * @returns {IndexRow[]}
 */
export declare function rankRows(rows: IndexRow[], query: string, { market }?: {
    market?: string | null;
}): IndexRow[];
export declare class StockLogosClient {
    baseUrl: string;
    _fetch: typeof fetch;
    /** @type {Map<string, Promise<any>>} */
    _cache: Map<string, Promise<any>>;
    /**
     * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
     *   baseUrl: where api/ and logos/ live (default: the jsDelivr CDN). Use '' or a path for a self-hosted copy.
     */
    constructor(options?: {
        baseUrl?: string;
        fetch?: typeof fetch;
    });
    /** @param {string} path @returns {Promise<any>} */
    _json(path: string): Promise<any>;
    /** API root: version, counts, data freshness and endpoint templates. @returns {Promise<ApiIndex>} */
    index(): Promise<ApiIndex>;
    /** All markets, largest first. @returns {Promise<Market[]>} */
    markets(): Promise<Market[]>;
    /** Companies of one market: main listings largest first, then secondary listings. @param {string} market @returns {Promise<CompanyRow[]>} */
    market(market: string): Promise<CompanyRow[]>;
    /** Full profile of one company. @param {string} market @param {string} ticker @returns {Promise<Company>} */
    company(market: string, ticker: string): Promise<Company>;
    /**
     * The compact index as raw rows, exactly as stored: [ticker, name, market, format, yahooTicker, marketCapUsd, flags, otherTickers?].
     * Cheaper than searchIndex() because no objects are built; use it for large scans.
     * @returns {Promise<IndexRow[]>}
     */
    searchRows(): Promise<IndexRow[]>;
    /**
     * The 2,000 largest companies as raw rows (about 220 KB), for a fast first screen. Same format as searchRows().
     * @returns {Promise<IndexRow[]>}
     */
    topRows(): Promise<IndexRow[]>;
    /** @param {IndexRow} r @returns {SearchHit} */
    static hit(r: IndexRow): SearchHit;
    /** Compact index of every company as objects. @returns {Promise<SearchHit[]>} */
    searchIndex(): Promise<SearchHit[]>;
    /**
     * Search by ticker or name (see rankRows for the ranking). An exchange spelling or former ticker finds the company:
     * "M&M", "ZOMATO". Punctuation in tickers is ignored: "brk b" finds BRK.B.
     * @param {string} query
     * @param {{ market?: string, limit?: number }} [options]
     * @returns {Promise<SearchHit[]>}
     */
    search(query: string, { market, limit }?: {
        market?: string;
        limit?: number;
    }): Promise<SearchHit[]>;
    /**
     * URL of a logo file.
     *   'svg' (default): the vector logo, which exists for all but 107 older companies;
     *   'png': a rendered PNG of the given size, which exists for the 3,000 largest companies (main listing, and the US listing if any);
     *   'original-png': the older PNG in logos/, for the 107 companies that have no SVG (see `format` in search results).
     * @param {string} market @param {string} ticker
     * @param {{ format?: 'svg' | 'png' | 'original-png', size?: 64 | 128 | 256 | 512 }} [options]
     */
    logoUrl(market: string, ticker: string, { format, size }?: {
        format?: 'svg' | 'png' | 'original-png';
        size?: 64 | 128 | 256 | 512;
    }): string;
    /**
     * URL of whichever logo file a search result actually has (SVG, or the older PNG).
     * @param {Pick<SearchHit, 'market' | 'ticker' | 'format'>} hit
     */
    logoOf(hit: Pick<SearchHit, 'market' | 'ticker' | 'format'>): string;
}
