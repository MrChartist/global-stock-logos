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

export const DEFAULT_BASE_URL = 'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main';

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
/** Tickers compare without punctuation: "m&m" finds M&M and M_M, "brk b" finds BRK.B. @param {unknown} s */
const bare = (s) => norm(s).replace(/[^a-z0-9]/g, '');

/** @type {WeakMap<IndexRow[], { t: string[], n: string[], o: string[][] }>} */
const folded = new WeakMap();
/** Fold every row once per index, not on every keystroke. @param {IndexRow[]} rows */
function foldRows(rows) {
    let f = folded.get(rows);
    if (!f) {
        f = { t: rows.map((r) => bare(r[0])), n: rows.map((r) => norm(r[1])), o: rows.map((r) => (r[7] || []).map(bare)) };
        folded.set(rows, f);
    }
    return f;
}

/**
 * Rank index rows for a query. Tiers: exact ticker (also an exchange spelling or former ticker such as M&M or ZOMATO);
 * ticker or name starts with the query; a word of the name starts with it; the name contains it.
 * A secondary listing (a copy of a company listed elsewhere) drops one tier. Inside a tier the larger company comes
 * first; between listings of about the same size (one company in several markets) the home-country listing wins.
 * @param {IndexRow[]} rows @param {string} query @param {{ market?: string | null }} [options]
 * @returns {IndexRow[]}
 */
export function rankRows(rows, query, { market } = {}) {
    const q = norm(query).trim(), qb = bare(query);
    if (!q) return [];
    const m = market ? market.toUpperCase() : null;
    const f = foldRows(rows);
    /** @type {{ i: number, score: number, size: number, home: number, cap: number }[]} */
    const hits = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (m && row[2] !== m) continue;
        const t = f.t[i], n = f.n[i];
        const tier = qb && (t === qb || f.o[i].includes(qb)) ? 0
            : (qb && (t.startsWith(qb) || f.o[i].some((o) => o.startsWith(qb)))) || n.startsWith(q) ? 1
            : n.includes(` ${q}`) ? 2 : n.includes(q) ? 3 : -1;
        if (tier < 0) continue;
        const secondary = ((row[6] || 0) & 1) === 1;
        const cap = row[5] || 0;
        hits.push({ i, score: tier + (secondary ? 1 : 0), size: Math.round(Math.log10(cap + 1) * 40), home: (row[6] || 0) & 4 ? 0 : 1, cap });
    }
    // size: about 6% wide steps of market cap, so copies of one company (same cap, a little FX noise) tie and home wins.
    return hits.sort((a, b) => a.score - b.score || b.size - a.size || a.home - b.home || b.cap - a.cap || a.i - b.i).map((h) => rows[h.i]);
}

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

    /** All markets, largest first. @returns {Promise<Market[]>} */
    markets() { return this._json('api/v1/markets.json'); }

    /** Companies of one market: main listings largest first, then secondary listings. @param {string} market @returns {Promise<CompanyRow[]>} */
    market(market) { return this._json(`api/v1/markets/${encodeURIComponent(market.toLowerCase())}.json`); }

    /** Full profile of one company. @param {string} market @param {string} ticker @returns {Promise<Company>} */
    company(market, ticker) {
        return this._json(`api/v1/companies/${encodeURIComponent(market.toLowerCase())}/${encodeURIComponent(ticker)}.json`);
    }

    /**
     * The compact index as raw rows, exactly as stored: [ticker, name, market, format, yahooTicker, marketCapUsd, flags, otherTickers?].
     * Cheaper than searchIndex() because no objects are built; use it for large scans.
     * @returns {Promise<IndexRow[]>}
     */
    searchRows() { return this._json('search-index.json'); }

    /**
     * The 2,000 largest companies as raw rows (about 220 KB), for a fast first screen. Same format as searchRows().
     * @returns {Promise<IndexRow[]>}
     */
    topRows() { return this._json('search-index-top.json'); }

    /** @param {IndexRow} r @returns {SearchHit} */
    static hit(r) {
        const flags = r[6] || 0;
        return {
            ticker: r[0], name: r[1], market: r[2], format: r[3], yahooTicker: r[4], marketCapUsd: r[5] ?? null,
            secondaryListing: (flags & 1) === 1, isPlaceholder: (flags & 2) === 2, homeListing: (flags & 4) === 4, otherTickers: r[7] || [],
        };
    }

    /** Compact index of every company as objects. @returns {Promise<SearchHit[]>} */
    async searchIndex() { return (await this.searchRows()).map(StockLogosClient.hit); }

    /**
     * Search by ticker or name (see rankRows for the ranking). An exchange spelling or former ticker finds the company:
     * "M&M", "ZOMATO". Punctuation in tickers is ignored: "brk b" finds BRK.B.
     * @param {string} query
     * @param {{ market?: string, limit?: number }} [options]
     * @returns {Promise<SearchHit[]>}
     */
    async search(query, { market, limit = 50 } = {}) {
        return rankRows(await this.searchRows(), query, { market }).slice(0, limit).map(StockLogosClient.hit);
    }

    /**
     * URL of a logo file.
     *   'svg' (default): the vector logo, which exists for all but a few older companies (45 in October 2026);
     *   'png': a rendered PNG of the given size, which exists for the 3,000 largest companies (main listing, and the US listing if any);
     *   'original-png': the older PNG in logos/, for the companies that have no SVG (see `format` in search results).
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
