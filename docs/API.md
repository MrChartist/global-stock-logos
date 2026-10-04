# API

A static JSON API for 75,000+ listed companies in 68 markets: logo, identity, market cap in local currency, USD and INR, and a company profile. Every endpoint is a plain file served by the [jsDelivr](https://www.jsdelivr.com/) CDN, so there is **no key, no sign-up and no server to go down**. Responses send permissive CORS headers, so browsers can call them directly.

Base URL: `https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main`

Machine-readable: [OpenAPI 3.1](../api/v1/openapi.json) · [JSON Schema of a company](../api/v1/schema/company.schema.json)

## Endpoints

| Endpoint | Returns |
| :--- | :--- |
| `GET /api/v1/index.json` | Version, counts, data freshness and every endpoint template |
| `GET /api/v1/markets.json` | All markets: `key`, `code`, `country`, `companies`, `url` |
| `GET /api/v1/markets/{market}.json` | Slim rows of one market, largest first: `ticker`, `name`, `sector`, `marketCapUsd`, `url` |
| `GET /api/v1/companies/{market}/{ticker}.json` | The full profile of one company |
| `GET /search-index.json` | Every company as `[ticker, name, market, format, yahooTicker, marketCapUsd]`, for search boxes |

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
  "marketCap": { "currency": "INR", "local": 7523089312358, "usd": 78081208603, "inr": 7523089312355, "asOf": "2026-10-04" },
  "profile": {
    "website": "https://www.tcs.com", "founded": 1968, "listingDate": "2004-08-25",
    "headquarters": "Mumbai", "headquartersLocal": null, "address": null, "addressLocal": null,
    "employees": 584519,
    "ceo": { "name": "…", "source": "wikidata", "confidence": "low" },
    "chairman": null, "slogan": null
  },
  "logo": {
    "svg": "https://…/logos/in/TCS.svg", "file": { "url": "https://…/logos/in/TCS.svg", "format": "svg" },
    "png": null, "brandColor": "#2E7DE1", "brandColorSource": "logo-tile", "isPlaceholder": false
  },
  "links": { "self": "https://…", "yahoo": "https://finance.yahoo.com/quote/TCS.NS", "website": "https://www.tcs.com" },
  "sources": { "listingDate": "nse-archive" }, "checks": null,
  "freshness": { "marketData": "2026-10-04", "profile": "2026-10-03" }
}
```

### How to read it

- **Unknown is `null`.** We never guess. Coverage per field is in [DATA.md](./DATA.md).
- **Market cap.** `local` is in the company's reporting currency (`marketCap.currency`). `usd` and `inr` are converted at the daily rate in [`fx-rates.json`](../fx-rates.json) and are approximate. `currency` (price currency) can differ: UK shares are priced in pence (`GBX`) but their market cap is in `GBP`.
- **Officers carry a source and a confidence.** `confidence: "low"` means community data (Wikidata) that may be years out of date; `"medium"` means exchange or registry data. Check before you rely on a name.
- **Logo.** `logo.svg` is the vector file; it is `null` for 107 older companies that only have a PNG, so use `logo.file.url`, which always exists. `logo.png` lists rendered sizes (64, 128, 256, 512) and exists for the 3,000 largest companies. `isPlaceholder: true` means a generated initials badge, not the real logo. `brandColor` is taken from the logo file: an approximation, not an official brand colour.
- **`listingDate`** is the first listing on an exchange, not the founding date.
- **`sources`** says where each value came from; **`checks`** records a second source that disagreed.
- **`freshness`** gives the dates of the last market-data and profile refresh. Data is refreshed monthly.

## JavaScript client

[`src/client.js`](../src/client.js) is a zero-dependency client for browsers and Node 18+, with TypeScript types in `src/client.d.ts`.

```js
import { StockLogosClient, ApiError } from 'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/src/client.js';

const api = new StockLogosClient();                       // or { baseUrl: 'https://your-host/' } for a self-hosted copy

await api.index();                                         // version, counts, freshness
await api.markets();                                       // all markets
await api.market('korea');                                 // companies of one market, largest first
await api.company('us', 'AAPL');                           // full profile
await api.search('tata', { market: 'in', limit: 10 });     // ranked: exact ticker, ticker prefix, name prefix, word prefix, contains
api.logoUrl('us', 'AAPL', { format: 'png', size: 128 });   // 'svg' (default) | 'png' | 'original-png'

try { await api.company('in', 'NOPE'); }
catch (e) { if (e instanceof ApiError && e.status === 404) { /* unknown company */ } }
```

Results are cached in memory; failed requests are not cached.

## Good practice

- **Pin a version for production.** `@main` always serves the latest data, and the CDN may cache it for hours. Use a commit hash (or a release tag, once releases are published) instead of `@main` for stable results: `…/global-stock-logos@<commit>/api/v1/…`.
- **Be kind to the CDN.** Cache responses on your side. The data changes monthly.
- **Use `search-index.json` once** (about 5 MB) and search in memory, as the [catalogue page](../index.html) does. Per-company files are small (about 1 KB).
- **Self-hosting.** The API is just the `api/`, `logos/`, `png/` and `search-index.json` paths of this repository. Serve them from any static host (GitHub Pages works) and pass `baseUrl` to the client.

## Versioning

The URL path carries the major version (`/api/v1/`). Within v1 we add fields but do not remove or rename them. A breaking change would ship as `/api/v2/` next to v1. `index.json` reports the data version.

## Limits and terms

There are no limits of our own. jsDelivr applies its own [fair-use policy](https://www.jsdelivr.com/terms/acceptable-use-policy-jsdelivr-net). Logos and brand names belong to their owners; see [DATA-SOURCES.md](../DATA-SOURCES.md) before commercial use. Profile data is for information only and is not investment advice.
