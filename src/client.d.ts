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
export declare const DEFAULT_BASE_URL = "https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main";
export type Person = {
    name: string;
    source: string;
    confidence: 'low' | 'medium' | 'high';
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
    listing: {
        status: 'listed' | 'delisted';
        delistedAt: string | null;
        successor: {
            company: string;
            url: string;
        } | null;
        source: string | null;
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
        provenance: 'official' | 'commons' | 'crawled' | 'generated';
        provenanceSource: string | null;
        hd?: string | null;
    };
    brands?: BrandRef[];
    institution?: {
        slug: string;
        name: string;
        url: string;
    } | null;
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
export type BrandRef = {
    slug: string;
    name: string;
    kind: BrandKind;
    logo: string;
    png: string;
    url: string;
};
export type BrandKind = 'brand' | 'subsidiary' | 'product' | 'service' | 'app';
export type Brand = {
    slug: string;
    name: string;
    aliases: string[];
    kind: BrandKind;
    category: string | null;
    description: string | null;
    founded: number | null;
    country: string | null;
    parent: {
        market: string;
        ticker: string;
        url: string;
    };
    otherListedOwners: string[];
    owners: {
        market: string;
        ticker: string;
        role: 'parent' | 'listed';
        url: string;
    }[];
    markets: string[];
    website: string | null;
    wikidata: string | null;
    brandColor: string | null;
    onDark: boolean;
    logo: {
        url: string;
        format: 'svg' | 'png';
        svg: string | null;
        mark: string | null;
        png: Record<string, string>;
    };
    sources: {
        logo: string;
        logoType: string;
        ownership: string | null;
        facts: Record<string, string> | null;
        checkedAt: string | null;
    };
    links: {
        self: string;
    };
};
export type Institution = {
    slug: string;
    name: string;
    shortName: string | null;
    aliases: string[];
    kind: string;
    country: string;
    description: string | null;
    founded: number | null;
    headquarters: string | null;
    legalBasis: string | null;
    parent: {
        institution?: string;
        company?: string;
        url: string;
    } | null;
    children: {
        slug: string;
        name: string;
        url: string;
    }[];
    listedAs: {
        company: string;
        url: string;
    } | null;
    website: string | null;
    wikidata: string | null;
    brandColor: string | null;
    onDark: boolean;
    logo: {
        url: string;
        format: 'svg' | 'png';
        svg: string | null;
        mark: string | null;
        png: Record<string, string>;
    };
    usageNote: string | null;
    sources: {
        logo: string;
        logoType: string;
        facts: Record<string, string> | null;
        checkedAt: string | null;
    };
    links: {
        self: string;
    };
};
export type Entity = {
    type: 'brand' | 'institution';
    id: string;
    name: string;
    shortName: string | null;
    aliases: string[];
    kind: string;
    owner: string | null;
    country: string | null;
    logo: string;
    onDark: boolean;
    url: string;
};
export type CompanyResult = {
    type: 'company';
    id: string;
    name: string;
    market: string;
    ticker: string;
    logo: string;
    url: string;
    hit: SearchHit;
};
export type FindResult = CompanyResult | Entity;
export type CompanyRow = {
    ticker: string;
    name: string;
    sector: string | null;
    marketCapUsd: number | null;
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
};
export type ApiIndex = {
    api: string;
    version: string;
    dataVersion: string;
    dataRefreshedAt: string;
    companies: number;
    markets: number;
    cdn: string;
    endpoints: Record<string, string>;
    docs: string;
};
/**
 * @typedef {{ name: string, source: string, confidence: 'low' | 'medium' | 'high' }} Person
 * @typedef {{
 *   ticker: string, market: string, name: string, legalName: string | null, aliases: string[],
 *   country: string | null, countryCode: string | null, flag: string | null, exchange: string | null,
 *   currency: string | null, isin: string | null, lei: string | null, cik: string | null, wikidata: string | null,
 *   classification: { sector: string | null, industry: string | null },
 *   listing: { status: 'listed' | 'delisted', delistedAt: string | null, successor: { company: string, url: string } | null, source: string | null },
 *   marketCap: { currency: string | null, local: number, usd: number | null, inr: number | null, asOf: string | null } | null,
 *   profile: {
 *     website: string | null, founded: number | null, listingDate: string | null,
 *     headquarters: string | null, headquartersLocal: string | null, address: string | null, addressLocal: string | null,
 *     employees: number | null, ceo: Person | null, chairman: Person | null, slogan: string | null
 *   },
 *   logo: { svg: string | null, file: { url: string, format: 'svg' | 'png' }, png: Record<string, string> | null, brandColor: string | null, brandColorSource: string | null, isPlaceholder: boolean, provenance: 'official' | 'commons' | 'crawled' | 'generated', provenanceSource: string | null, hd?: string | null },
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
export declare class ApiError extends Error {
    status: number;
    url: string;
    /** @param {string} message @param {number} status @param {string} url */
    constructor(message: string, status: number, url: string);
}
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
    /** Every brand, sub-brand and subsidiary with its listed parent, by name. @returns {Promise<Brand[]>} */
    brands(): Promise<Brand[]>;
    /** One brand by slug, e.g. 'jio' or 'instagram'. @param {string} slug @returns {Promise<Brand>} */
    brand(slug: string): Promise<Brand>;
    /** Market institutions (regulators, governments, exchanges, depositories, payment systems...), by name. @returns {Promise<Institution[]>} */
    institutions(): Promise<Institution[]>;
    /** One institution by slug, e.g. 'sebi', 'rbi' or 'upi'. @param {string} slug @returns {Promise<Institution>} */
    institution(slug: string): Promise<Institution>;
    /** Every brand and institution as one small search index (companies are in searchRows()). @returns {Promise<Entity[]>} */
    entities(): Promise<Entity[]>;
    /**
     * One search across companies, brands and institutions, e.g. find('surf') → Surf Excel (brand) and Hindustan Unilever.
     * Ranking within each type: exact name or alias, prefix, word prefix, contains; brands and institutions come before
     * companies with the same score, because a name like "UPI" or "Jio" means the brand.
     * @param {string} query
     * @param {{ types?: ('company' | 'brand' | 'institution')[], limit?: number, market?: string }} [options]
     * @returns {Promise<FindResult[]>}
     */
    find(query: string, { types, limit, market }?: {
        types?: ('company' | 'brand' | 'institution')[];
        limit?: number;
        market?: string;
    }): Promise<FindResult[]>;
    /** Brands a company owns or sells (from its profile). @param {string} market @param {string} ticker @returns {Promise<BrandRef[]>} */
    brandsOf(market: string, ticker: string): Promise<BrandRef[]>;
    /** PNG of a brand's logo; 256 and 512 always exist, 1024 for vector logos and large originals. @param {string} slug @param {256 | 512 | 1024} [size] */
    brandLogoUrl(slug: string, size?: 256 | 512 | 1024): string;
    /** PNG of an institution's logo; 256 and 512 always exist, up to 2048 for vector logos. @param {string} slug @param {256 | 512 | 1024 | 2048} [size] */
    institutionLogoUrl(slug: string, size?: 256 | 512 | 1024 | 2048): string;
    /** All markets, largest first. @returns {Promise<Market[]>} */
    markets(): Promise<Market[]>;
    /** Companies of one market, largest first. @param {string} market @returns {Promise<CompanyRow[]>} */
    market(market: string): Promise<CompanyRow[]>;
    /** Full profile of one company. @param {string} market @param {string} ticker @returns {Promise<Company>} */
    company(market: string, ticker: string): Promise<Company>;
    /**
     * The compact index as raw rows, exactly as stored: [ticker, name, market, format, yahooTicker, marketCapUsd].
     * Cheaper than searchIndex() because no objects are built; use it for large scans.
     * @returns {Promise<[string, string, string, 'svg' | 'png', string, number | null][]>}
     */
    searchRows(): Promise<[string, string, string, 'svg' | 'png', string, number | null][]>;
    /**
     * The 2,000 largest companies as raw rows (about 220 KB), for a fast first screen. Same format as searchRows().
     * @returns {Promise<[string, string, string, 'svg' | 'png', string, number | null][]>}
     */
    topRows(): Promise<[string, string, string, 'svg' | 'png', string, number | null][]>;
    /** @param {[string, string, string, 'svg' | 'png', string, number | null]} r @returns {SearchHit} */
    static hit(r: [string, string, string, 'svg' | 'png', string, number | null]): SearchHit;
    /** Compact index of every company as objects. @returns {Promise<SearchHit[]>} */
    searchIndex(): Promise<SearchHit[]>;
    /**
     * Search by ticker or name. Ranking: exact ticker, ticker prefix, name starts with the query, word prefix, contains.
     * Ties keep the index order (largest companies first).
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
     *   'png': a rendered PNG of the given size, which exists for the 3,000 largest companies;
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
