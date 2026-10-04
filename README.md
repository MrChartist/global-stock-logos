# Global Stock Logos

<div align="center">

**Free, open-source company logos and profiles for 75,000+ listed stocks in 68 markets, with a static JSON API.**

A project by **[@MrChartist](https://mrchartist.com)** · [mrchartist.com](https://mrchartist.com)

![Companies](https://img.shields.io/badge/companies-75%2C000%2B-2563eb?style=for-the-badge)
![Markets](https://img.shields.io/badge/markets-68-7c3aed?style=for-the-badge)
![API](https://img.shields.io/badge/API-static%20JSON-0ea5e9?style=for-the-badge)
![Licence](https://img.shields.io/badge/code-MIT-16a34a?style=for-the-badge)

[Catalogue](./index.html) · [API](./docs/API.md) · [Integrations](./docs/INTEGRATIONS.md) · [Data](./docs/DATA.md) · [Contribute](./CONTRIBUTING.md)

</div>

---

## What you get

- **Logos.** A vector SVG for every company (PNG sizes 64 to 512 px for the 3,000 largest), served free by the jsDelivr CDN.
- **A company profile.** Name, ISIN, sector, exchange, market cap in local currency, **USD and INR**, website, founding year, headquarters, employees, CEO and chairman, listing date, and a brand colour. Unknown values are `null`; we do not guess.
- **A static JSON API.** One small file per company, with an [OpenAPI spec](./api/v1/openapi.json), a [JSON Schema](./api/v1/schema/company.schema.json) and a [typed JavaScript client](./src/client.js). No key, no server.
- **A catalogue page.** Search, filter by market, open any company and copy ready-made embed code: [`index.html`](./index.html). It follows the look of mrchartist.com (light and dark themes, glass navigation, iOS-style detail sheet; see [docs/DESIGN.md](./docs/DESIGN.md)) and scores 99 to 100 in every Lighthouse category on mobile and desktop. Links can carry state: `?q=tata&market=IN&sort=name`, `#/IN/TCS` for a company, and `?theme=dark` or `?theme=light`.
- **Monthly refresh.** A resumable pipeline keeps data current, checks every value, and records where each one came from.

## Quick start

**A logo** (the path is `logos/<market>/<TICKER>.svg`):

```html
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/TCS.svg" width="32" height="32" alt="TCS logo">
```

**A company** (market and ticker as in the path above):

```bash
curl -s https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/api/v1/companies/in/TCS.json
```

**With the client:**

```js
import { StockLogosClient } from 'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/src/client.js';

const api = new StockLogosClient();
const tcs = await api.company('in', 'TCS');
console.log(tcs.marketCap.usd, tcs.marketCap.inr, tcs.logo.svg);

const hits = await api.search('samsung', { limit: 5 });
```

## Documentation

| Page | What is in it |
| :--- | :--- |
| [docs/API.md](./docs/API.md) | Endpoints, the company object, how to read it, client, good practice, versioning |
| [docs/INTEGRATIONS.md](./docs/INTEGRATIONS.md) | HTML, React and Next.js, Flutter, Python |
| [docs/DATA.md](./docs/DATA.md) | Every field, where it comes from, coverage today, logo quality |
| [docs/DATA-COVERAGE.md](./docs/DATA-COVERAGE.md) | What each field can reach, what we tested, what is blocked |
| [docs/DESIGN.md](./docs/DESIGN.md) | The design system of the catalogue page: colour, type, motion, behaviour, quality bar |
| [docs/ADAPTERS.md](./docs/ADAPTERS.md) | How to add a verified data source for a market |
| [TODO.md](./TODO.md) | Open work: owner settings, data coverage, data quality, product, and how to work from a server |
| [DATA-SOURCES.md](./DATA-SOURCES.md) | Sources, terms and how to ask for a logo to be removed |

## Repository layout

```
index.html, assets/             The catalogue page (no build step; works on GitHub Pages)
logos/<market>/<TICKER>.svg     Logo files, one folder per market
png/<size>/<market>/            PNG sizes (64, 128, 256, 512) for the 3,000 largest companies
api/v1/                         The static JSON API (generated)
manifests/<market>.json         Company profiles per market (generated)
logos-manifest.json             Summary, market names and index of market files
search-index.json               Compact search index, largest companies first (5 MB)
search-index-top.json           The 2,000 largest companies of it (158 KB), for a fast first screen
enrichment/<market>.json        Raw profile data with sources and retrieval dates
companies-metadata.json         Company metadata used to build the manifests
fx-rates.json                   Exchange rates used for market cap in USD and INR
*-report.json, pipeline-status.json   Results of the last checks and pipeline run
curated/overrides.json          Hand-checked facts that always win (slogans, corrections)
src/                            API client (client.js, client.d.ts) and a React component
scripts/                        The pipeline, checks and generators (run-all.js runs it all)
docs/                           Documentation
.github/workflows/              ci.yml, daily-sync.yml, monthly-refresh.yml
```

Files marked generated are rebuilt by the pipeline; please do not edit them by hand.

## Commands

```bash
npm ci                   # install the development tools (the data and client need none)
npm test                 # everything CI checks: logos, data, API, client
npm run all              # the whole data pipeline; run again until it reports complete
npm run sync             # rebuild manifests and search index
npm run api              # rebuild the static API (api/v1/)
npm run test:frontend    # browser test of the catalogue page (needs Chromium)
npm run lighthouse       # Lighthouse scores of the page: mobile, desktop, light, dark
npm run typecheck        # type-check the client
```

Other steps, one at a time: `bulk`, `refresh`, `enrich`, `registries`, `colors`, `png`, `quality`, `quality:fix`, `validate`.

## Renamed companies and tickers with special characters

Exchanges use tickers that a file name or URL handles badly (`M&M`, `ARE&M`, `GVT&D`), and companies change ticker when they are renamed (`ZOMATO` is now `ETERNAL`, `INFOSYSTCH` is `INFY`, `TATAMOTORS` is `TMPV`). These used to end up with a missing logo, a leftover image with no company details, or the wrong name, while the real logo sat under another file name.

Now every such ticker has its own file that is a copy of the real logo, so the URL you build from the ticker you have always works:

```html
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/ZOMATO.svg" />  <!-- Eternal -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/M&M.svg" />     <!-- Mahindra & Mahindra -->
```

- The list is [`curated/aliases.json`](./curated/aliases.json): `"IN:ZOMATO": { "logoOf": "ETERNAL" }`. It was built by matching ISIN numbers, so an alias exists only when it is the same legal entity.
- `npm run aliases` copies the real logo to each alias file. `npm run sync` runs it first, so a placeholder created by a later crawl is repaired automatically. `npm run aliases:check` changes nothing and exits with an error if an alias is out of date.
- An alias has its own manifest entry and API file with the real company's details (and a `logoOf` field in the manifest). It is **not** counted as another company and is not listed in the search index or the market lists. `api/v1/index.json` reports the number of aliases separately.
- Known limit: NSE and BSE tickers share one folder per country, so two different companies that use the same ticker on the two exchanges can still collide. Needs verification, one by one.

## Contributing

Contributions are welcome, especially official logos for companies listed in `quality-report.json`. Read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md) first.

1. Fork the repository and create a branch.
2. Add a clean SVG as `logos/<market>/<TICKER>.svg`. Please use only official or openly licensed artwork.
3. Run `npm run quality` and `npm run sync`.
4. Open a pull request and mention the source of the logo.

To report a wrong or missing logo, open an issue with the ticker and market.

## Licence and trademarks

- Code, scripts and workflows are released under the [MIT License](./LICENSE).
- All logos, brand names and emblems belong to their respective owners. They are included for editorial and informational use, such as stock identification in charts, research and learning material. Inclusion does not mean endorsement by, or affiliation with, any company.
- Logos from Wikimedia Commons keep their own licences; see `logo-sources.json`. If you are a rights holder and want a logo removed, write to [contact@mrchartist.com](mailto:contact@mrchartist.com).
- Logo data comes from TradingView's public symbol-logo service and Wikidata. Please check their terms before heavy commercial use. Full details are in [DATA-SOURCES.md](./DATA-SOURCES.md).
- Security issues: see [SECURITY.md](./SECURITY.md).

## Disclaimer

This project is for education and information only. It is not investment advice. Market data, tickers and Yahoo Finance links should be verified before use.

---

Built by **[@MrChartist](https://mrchartist.com)** · [mrchartist.com](https://mrchartist.com)
