# Global Stock Logos

<div align="center">

**Free, open-source company logos and profiles for 80,000+ listed stocks in 68 markets, with a static JSON API.**

A project by **[@MrChartist](https://mrchartist.com)** · [mrchartist.com](https://mrchartist.com)

![Companies](https://img.shields.io/badge/companies-80%2C000%2B-2563eb?style=for-the-badge)
![Markets](https://img.shields.io/badge/markets-68-7c3aed?style=for-the-badge)
![API](https://img.shields.io/badge/API-static%20JSON-0ea5e9?style=for-the-badge)
![Licence](https://img.shields.io/badge/code-MIT-16a34a?style=for-the-badge)

[Catalogue](./index.html) · [API](./docs/API.md) · [Integrations](./docs/INTEGRATIONS.md) · [Data](./docs/DATA.md) · [Contribute](./CONTRIBUTING.md)

</div>

---

## Logo provenance and rights

Read this before you put the logos on a website. It states facts about where the files come from; it is not legal advice and makes no claim about whether any use is lawful.

- **Most logos were crawled.** The square icons were collected from TradingView's public symbol-logo service, not from each owner's own site. They have not been checked file by file against the owner's current design. Not verified, not known to be wrong.
- **Every company file says which kind of logo it has.** `logo.provenance` in `api/v1/companies/<market>/<TICKER>.json` (and `logo.provenanceSource`, the page the file came from):

| `logo.provenance` | Meaning | Count |
| :--- | :--- | ---: |
| `official` | Checked against the owner's site, press kit or an official document | 0 |
| `commons` | Wikimedia Commons; the file keeps its own licence | 3 |
| `crawled` | TradingView symbol-logo service, not checked file by file | 80,256 |
| `generated` | An initials badge drawn by this project, not a real logo (`isPlaceholder: true`) | 180 |

  Counts are from `api/v1/index.json` (`logoProvenance`, 80,439 listings) as of 2026-10-24 and change when the data is rebuilt. Brands, HD logos and institutions are separate: they are taken from the owner's site, an official document or Wikimedia Commons, with the source recorded per entry in `brands/brands.json` and `institutions/institutions.json`.
- **What a site should show.** If you need every logo to have a known source (a paid product, an app-store listing, a legal review), show only `official` and `commons` and use your own fallback for the rest. That is 3 logos today, so most sites will not do this yet. If you accept the position described here, you may show `crawled` logos as well, but keep a takedown contact visible on your site, never show `generated` badges as if they were logos, and do not use a logo to suggest endorsement. [docs/PRODUCTION.md](./docs/PRODUCTION.md#2-decide-which-logos-you-show) has the filter code and checklist.
- **Taking a logo down.** Rights holders, and anyone who sees a wrong logo, can ask for a file to be removed or replaced: open an issue with the [removal request form](https://github.com/MrChartist/global-stock-logos/issues/new?template=removal-request.yml), or use the contact in [SECURITY.md](./SECURITY.md). The process, the proposed 7-day response target and the log of requests are in [docs/TAKEDOWN.md](./docs/TAKEDOWN.md). A dedicated takedown address is still to be set by the repository owner.
- **Where the files come from, in full:** [DATA-SOURCES.md](./DATA-SOURCES.md). Code is MIT; logos and brand names belong to their owners (see [Licence and trademarks](#licence-and-trademarks)).

## What you get

- **Logos.** A vector SVG for every company (PNG sizes 64 to 512 px for the 3,000 largest), served free by the jsDelivr CDN.
- **Brands, not just companies.** 871 consumer brands, sub-brands and subsidiaries (Jio, Blinkit, Tanishq, Surf Excel, Maggi, Sunfeast, YONO, Myntra, Instagram, Lexus, Zara...), each linked to its listed owner, as official HD logos (vector, or an official raster of at least 1,000 px) with PNGs up to 1024 px. See [docs/BRANDS.md](./docs/BRANDS.md).
- **Market institutions.** 74 Indian regulators, government bodies and market infrastructure (SEBI, RBI, NSE, BSE, NSDL, CDSL, NPCI, UPI, RuPay, IRDAI, AMFI...) with official logos in HD (PNG up to 2048 px). See [docs/BRANDS.md](./docs/BRANDS.md#market-institutions).
- **HD full logos.** The official full logo (wordmark or lock-up) of 740 large companies, next to the square icon: `logos-hd/<market>/<TICKER>.svg` (or an official `.png` of at least 1,000 px when no vector exists).
- **A company profile.** Name, ISIN, sector, exchange, market cap in local currency, **USD and INR**, website, founding year, headquarters, employees, CEO and chairman, listing date, and a brand colour. Unknown values are `null`; we do not guess. For India's 400 largest companies, Korea's 100 largest and about 100 other large companies, the website, founding year, headquarters, CEO and chairman were checked by hand against company pages and exchange or SEC filings, with a source link for every value.
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
| [docs/BRANDS.md](./docs/BRANDS.md) | Brands and sub-brands, HD full logos, hand-checked profile facts, and how to add them |
| [docs/DESIGN.md](./docs/DESIGN.md) | The design system of the catalogue page: colour, type, motion, behaviour, quality bar |
| [docs/ADAPTERS.md](./docs/ADAPTERS.md) | How to add a verified data source for a market |
| [docs/PRODUCTION.md](./docs/PRODUCTION.md) | Before you use it on a live website: pin a version, choose which logos to show, fallbacks, confidence |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Audit of where the project stands, and the phased plan to make it ready for production websites |
| [TODO.md](./TODO.md) | Open work: owner settings, data coverage, data quality, product, and how to work from a server |
| [docs/TAKEDOWN.md](./docs/TAKEDOWN.md) | How to ask for a logo to be removed or corrected, response target, request log |
| [CHANGELOG.md](./CHANGELOG.md) | What changed, release by release |
| [DATA-SOURCES.md](./DATA-SOURCES.md) | Sources, terms and how to ask for a logo to be removed |

## Repository layout

```
index.html, assets/             The catalogue page (no build step; works on GitHub Pages)
logos/<market>/<TICKER>.svg     Logo files, one folder per market
png/<size>/<market>/            PNG sizes (64, 128, 256, 512) for the 3,000 largest companies
logos-hd/<market>/<TICKER>.svg  Official full logos (wordmark or lock-up)
brands/                         Brand registry (brands.json), logos and PNGs (256, 512, 1024)
institutions/                   Market institutions (institutions.json), logos and PNGs (256 to 2048)
api/v1/                         The static JSON API (generated)
manifests/<market>.json         Company profiles per market (generated)
logos-manifest.json             Summary, market names and index of market files
search-index.json               Compact search index, largest companies first (5 MB)
search-index-top.json           The 2,000 largest companies of it (158 KB), for a fast first screen
enrichment/<market>.json        Raw profile data with sources and retrieval dates
companies-metadata.json         Company metadata used to build the manifests
fx-rates.json                   Exchange rates used for market cap in USD and INR
*-report.json, pipeline-status.json   Results of the last checks and pipeline run
curated/overrides.json          Hand-checked facts that always win, each with its source URL
src/                            API client (client.js, client.d.ts) and a React component
scripts/                        The pipeline, checks and generators (run-all.js runs it all)
docs/                           Documentation
.github/workflows/              ci.yml, daily-sync.yml, monthly-refresh.yml, weekly-report.yml
```

Files marked generated are rebuilt by the pipeline; please do not edit them by hand.

## Commands

```bash
npm ci                   # install the development tools (the data and client need none)
npm test                 # everything CI checks: logos, data, API, client
npm run all              # the whole data pipeline; run again until it reports complete
npm run sync             # rebuild manifests and search index
npm run api              # rebuild the static API (api/v1/)
npm run brands           # check brands/brands.json and render brand PNGs
npm run institutions     # check institutions/institutions.json and render institution PNGs
npm run test:frontend    # browser test of the catalogue page (needs Chromium)
npm run lighthouse       # Lighthouse scores of the page: mobile, desktop, light, dark
npm run typecheck        # type-check the client
npm run numbers          # headline numbers; `-- --check` verifies the texts (part of npm test)
npm run diff-report -- <old> <new>   # markdown diff of two manifests or API snapshots
npm run check-logo-sources -- --base origin/main   # PR guard: forbidden logo sources
npm run weekly-report    # stale data, placeholders and warnings
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
- Logos from Wikimedia Commons keep their own licences; see `logo-sources.json`. If you are a rights holder and want a logo removed, follow [docs/TAKEDOWN.md](./docs/TAKEDOWN.md).
- Most logos come from TradingView's public symbol-logo service (see [Logo provenance and rights](#logo-provenance-and-rights)); facts come from Wikidata and the sources in [DATA-SOURCES.md](./DATA-SOURCES.md). Please check their terms before heavy commercial use.
- Security issues: see [SECURITY.md](./SECURITY.md).

## Disclaimer

This project is for education and information only. It is not investment advice. Market data, tickers and Yahoo Finance links should be verified before use.

---

Built by **[@MrChartist](https://mrchartist.com)** · [mrchartist.com](https://mrchartist.com)
