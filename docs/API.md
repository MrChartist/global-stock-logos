# API

A static JSON API for 75,000+ listed companies in 68 markets: logo, identity, market cap in local currency, USD and INR, and a company profile. Every endpoint is a plain file served by the [jsDelivr](https://www.jsdelivr.com/) CDN, so there is **no key, no sign-up and no server to go down**. Responses send permissive CORS headers, so browsers can call them directly.

Base URL: `https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main`

Machine-readable: [OpenAPI 3.1](../api/v1/openapi.json) · [JSON Schema of a company](../api/v1/schema/company.schema.json)

## Endpoints

| Endpoint | Returns |
| :--- | :--- |
| `GET /api/v1/index.json` | Version, counts, data freshness and every endpoint template |
| `GET /api/v1/markets.json` | All markets: `key`, `code`, `country`, `companies`, `url` |
| `GET /api/v1/markets/{market}.json` | Slim rows of one market: main listings largest first, then secondary listings. `ticker`, `name`, `sector`, `marketCapUsd`, `secondaryListing`, `url` |
| `GET /api/v1/companies/{market}/{ticker}.json` | The full profile of one company |
| `GET /search-index-top.json` | The 2,000 largest companies in the same format (about 160 KB): render a first screen quickly, then load the full index |
| `GET /search-index.json` | Every company as `[ticker, name, market, format, yahooTicker, marketCapUsd, flags, otherTickers?]`, for search boxes (see below) |

`{market}` is the lower-case market key from `markets.json` (`us`, `in`, `uk`, `japan`, `korea`, ...). `{ticker}` is the ticker as listed in the market file; URL-encode special characters. A company that does not exist returns **404**.

```bash
curl -s https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/api/v1/companies/in/TCS.json
```

## A company

```jsonc
{
  "ticker": "TCS", "market": "IN", "name": "Tata Consultancy Services Limited",
  "aliases": [], "country": "India", "countryCode": "IN", "flag": "🇮🇳",
  "exchange": "NSE", "currency": "INR", "isin": "INE467B01029", "lei": null, "cik": null, "wikidata": "Q13227919",
  "classification": { "sector": "Technology Services", "industry": "Information Technology Services" },
  "marketCap": { "currency": "INR", "local": 7590747370117, "usd": 78687038246, "inr": 7590747370117, "asOf": "2026-10-07" },
  "profile": {
    "website": "https://www.tcs.com", "founded": 1968, "listingDate": "2004-08-25",
    "headquarters": "Mumbai", "headquartersLocal": null, "address": null, "addressLocal": null,
    "employees": 584519,
    "ceo": { "name": "K. Krithivasan", "source": "curated", "confidence": "medium", "since": "2023-06-01" },
    "chairman": null, "slogan": null
  },
  "logo": {
    "svg": "https://…/logos/in/TCS.svg", "file": { "url": "https://…/logos/in/TCS.svg", "format": "svg" },
    "png": { "64": "https://…/png/64/in/TCS.png", "128": "…", "256": "…", "512": "…" },
    "brandColor": "#2E7DE1", "brandColorSource": "logo-tile", "isPlaceholder": false
  },
  "secondaryListing": false, "aliasOf": null,
  "links": { "self": "https://…", "yahoo": "https://finance.yahoo.com/quote/TCS.NS", "website": "https://www.tcs.com" },
  "sources": { "listingDate": "nse-archive", "ceo": "curated", "ceoSince": "curated" }, "checks": null,
  "freshness": { "marketData": "2026-10-07", "profile": "2026-10-07" }
}
```

### How to read it

- **Unknown is `null`.** We never guess. Coverage per field is in [DATA.md](./DATA.md).
- **Market cap.** `local` is in the company's reporting currency (`marketCap.currency`). `usd` and `inr` are converted at the daily rate in [`fx-rates.json`](../fx-rates.json) and are approximate, except that the reporting currency itself is exact (`inr` equals `local` for an Indian company). `asOf` is the date of the market data; a listing the scanner no longer returns keeps its last value with its original date. `currency` (price currency) can differ: UK shares are priced in pence (`GBX`) but their market cap is in `GBP`.
- **Officers carry a source, a confidence and a start date.** `confidence: "low"` means community data (Wikidata) that may be out of date; `"medium"` means exchange, registry or hand-checked (`source: "curated"`) data. `since` is the start of the term when the source records it; `null` means unknown. From Wikidata we take the CEO it ranks as current, else the open-ended term that started last; ended terms are ignored, and when several undated terms leave it unclear, the CEO is `null`. Check before you rely on a name.
- **`secondaryListing: true`** marks a copy of a company whose main listing is in another market: a depositary receipt, CEDEAR, BDR or cross-listing (NVIDIA trades in about 30 markets), or a preferred-share series of a listed company. Listings of the same brand with a market cap within 5% are one company, and the listing in its own country is the main one. Secondary listings come after main listings in market lists and the search index.
- **`aliasOf`** is set on an exchange spelling or former ticker (`M&M`, `ZOMATO`): the file repeats the company it names, and it is not counted as another company.
- **Logo.** `logo.svg` is the vector file; it is `null` for the few older companies that only have a PNG (45 in October 2026), so use `logo.file.url`, which always exists. `logo.png` lists rendered sizes (64, 128, 256, 512) and exists for the 3,000 largest companies: on the main listing, and on the US listing when there is one. `isPlaceholder: true` means a generated initials badge, not the real logo. `brandColor` is taken from the logo file: an approximation, not an official brand colour.
- **`listingDate`** is the first listing on an exchange, not the founding date.
- **`sources`** says where each value came from; **`checks`** records a second source that disagreed.
- **`freshness`** gives the dates of the last market-data and profile refresh. Data is refreshed monthly.

### The search index

`search-index.json` is one array per company: `[ticker, name, market, format, yahooTicker, marketCapUsd, flags, otherTickers?]`.

- `flags` is a bit set: `1` secondary listing, `2` generated badge (no real logo yet), `4` listed in the company's own country.
- `otherTickers` appears only when there are any: exchange spellings and former tickers of the same company (`["M&M"]` on `M_M`, `["ZOMATO"]` on `ETERNAL`).
- Rows are ordered main listings first, largest first. `search-index-top.json` is its first 2,000 rows.
- `yahooTicker` follows Yahoo's spelling where it differs from ours: `BRK-B` (US share classes), `NOVO-B.CO` (Nordic share classes), `M&M.NS` (India, when an alias proves the exchange spelling).

## JavaScript client

[`src/client.js`](../src/client.js) is a zero-dependency client for browsers and Node 18+, with TypeScript types in `src/client.d.ts`.

```js
import { StockLogosClient, ApiError } from 'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/src/client.js';

const api = new StockLogosClient();                       // or { baseUrl: 'https://your-host/' } for a self-hosted copy

await api.index();                                         // version, counts, freshness
await api.markets();                                       // all markets
await api.market('korea');                                 // companies of one market: main listings largest first, then copies
await api.company('us', 'AAPL');                           // full profile
await api.search('tata', { market: 'in', limit: 10 });     // exact ticker (also M&M, ZOMATO), prefix, word, contains; home listings first
api.logoUrl('us', 'AAPL', { format: 'png', size: 128 });   // 'svg' (default) | 'png' | 'original-png'

try { await api.company('in', 'NOPE'); }
catch (e) { if (e instanceof ApiError && e.status === 404) { /* unknown company */ } }
```

Results are cached in memory; failed requests are not cached.

## Good practice

- **Pin a version for production.** `@main` always serves the latest data, and the CDN may cache it for hours. Each completed monthly refresh is tagged `data-YYYY-MM` (for example `data-2026-11`); use that tag, or a commit hash, instead of `@main` for stable results: `…/global-stock-logos@data-2026-11/api/v1/…`.
- **Be kind to the CDN.** Cache responses on your side. The data changes monthly.
- **Use `search-index.json` once** (about 5 MB) and search in memory, as the [catalogue page](../index.html) does. Render a first screen from `search-index-top.json` (about 160 KB) and load the full index only when needed. Per-company files are small (about 1 KB).
- **Self-hosting.** The API is just the `api/`, `logos/`, `png/` and `search-index.json` paths of this repository. Serve them from any static host (GitHub Pages works) and pass `baseUrl` to the client.

## Versioning

The URL path carries the major version (`/api/v1/`). Within v1 we add fields but do not remove or rename them. A breaking change would ship as `/api/v2/` next to v1. `index.json` reports the data version.

## Limits and terms

There are no limits of our own. jsDelivr applies its own [fair-use policy](https://www.jsdelivr.com/terms/acceptable-use-policy-jsdelivr-net). Logos and brand names belong to their owners; see [DATA-SOURCES.md](../DATA-SOURCES.md) before commercial use. Profile data is for information only and is not investment advice.
