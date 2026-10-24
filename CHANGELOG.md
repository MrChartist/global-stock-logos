# Changelog

All notable changes to the data, the API and the tools. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The package version is `3.0.0`; dates are commit dates. The daily sync commits (new listings and logos, manifests, API) are not listed one by one.

To see what changed in the data between two points in history, run `npm run diff-report -- <old-ref> <new-ref>` (companies added, removed and renamed, CEO and chairman changes, logo changes).

## [Unreleased]

### Added

- `docs/TAKEDOWN.md`: how to ask for a logo to be removed or corrected, what to include, a proposed 7-day response target (for the owner to confirm), and an empty request log.
- README: a "Logo provenance and rights" section near the top with the `logo.provenance` values and counts, what a site should show, and the takedown route.
- `scripts/numbers.js` (`npm run numbers`): one definition of the headline number (listings with a logo that is not a generated placeholder, rounded down to 1,000: 80,000+). `--check` runs in `npm test` and `npm run check` and verifies README.md, CLAUDE.md, package.json, docs/API.md and index.html, the number of markets and the provenance table against `api/v1/index.json`.
- `scripts/diff-report.js` (`npm run diff-report`): markdown diff of two manifests or API snapshots, given as paths or git refs.
- `scripts/check-logo-sources.js` and a pull-request job in `ci.yml`: rejects added logos whose source record, commit message or pull-request description names TradingView, Clearbit, Brandfetch or a logo aggregator site, and runs `logo-tool.js check` on added SVGs.
- `scripts/weekly-report.js` and `.github/workflows/weekly-report.yml`: market data older than 7 days, placeholders and validation warnings, written to the job summary every Monday.

### Changed

- Headline number is 80,000+ listed companies everywhere (it said 75,000+ in README.md, package.json, docs/API.md and index.html, and 79,000+ in CLAUDE.md).

## 2026-10-24: Provenance labels, roadmap, officers for large companies

### Added

- `logo.provenance` and `logo.provenanceSource` on every company (`official`, `commons`, `crawled`, `generated`), `logoProvenance` counts in `api/v1/index.json`, and `curated/logo-provenance.json` to record a checked source.
- `docs/PRODUCTION.md` (pin a version, choose which logos to show, fallbacks, confidence), `npm run tiers` (field coverage by size tier) and `docs/ROADMAP.md` (measured audit and phased plan).

### Data

- CEO, chairman, website, founding year and headquarters hand-checked, with a source URL per value, for large companies in the UK (145), Japan (116), China and Hong Kong, Continental Europe, Canada and Australia, Taiwan and South-East Asia, Latin America and the Middle East; India's officers ranked 400 to 1000 (meeting chairs excluded); 214 more founding years.
- Three wrong aliases fixed; ticker renames taken from NSE and SEC; reviewed India HD logo batch merged; duplicate India listings aliased.

## 2026-10-23: Brands, institutions, HD logos, NSE filings

### Added

- A brand registry (871 brands, sub-brands and subsidiaries, each linked to its listed owner), HD full logos (740 companies) and PNGs up to 1,024 px. See `docs/BRANDS.md`.
- An institutions collection (74 Indian regulators, exchanges, payment systems and other market bodies) with PNGs up to 2,048 px, and an Institutions section on the catalogue page.
- One search across companies, brands and institutions in the API, with linked records.
- NSE filings adapter (`scripts/adapters/nse-filings.js`): chairperson, CEO, website, incorporation year, address and employees for Indian companies, with the filing URL per field.
- `scripts/logo-tool.js` (check, clean, preview and look up a logo); CLAUDE.md; type-check of the React component.

### Changed

- Official rasters of at least 1,000 px are accepted for a logo when no vector exists.
- PNG sizes are ranked by home listing for the 3,000 largest companies.

### Fixed

- Outdated and wrong logos replaced; renamed companies and delisted companies corrected; duplicate-line officers removed; 274 founding years checked against company pages and filings.

## 2026-10-22: Brand catalogue

### Added

- First 441 brands and 328 HD logos with hand-checked profile sources.

### Fixed

- 67 PNGs that were GoDaddy's logo, not the company's, removed.
- Very large SVGs render in previews and brand PNGs; `logo-tool` accepts a logo drawn as a single compound path.

## 2026-10-04: Static API v1, new catalogue page

### Added

- The static JSON API `api/v1/` with an OpenAPI spec, JSON Schemas and a typed JavaScript client; the catalogue page was rebuilt (Lighthouse 99 to 100 in every category) with light and dark themes and links that carry state.
- Logos for 709 Indian funds and stocks that had none, with flagged initials badges for the rest.
- `TODO.md`, the adapter kit and plug-in adapter loader, INR market cap, and the coverage tool.

### Changed

- Market cap is stored in USD as well as local currency; the ranking was corrected; legacy scripts were removed.

### Fixed

- Logos for renamed companies and tickers with special characters (Zomato to Eternal, M&M, ARE&M), through `curated/aliases.json`.

## 2026-10-03: Company profiles and the data pipeline

### Added

- Company profiles, brand colours, PNG sizes and the monthly refresh workflow; a resumable auto-finishing pipeline with data validation; name-based GLEIF and Wikidata matching; exchange and registry sources with cross-checks.
- Wikidata and Wikimedia Commons fallback logos for companies without a TradingView logo.
- The first global expansion of the logo directory (UK, Germany, France, Japan, Canada, Australia, Hong Kong, CAC 40, XETRA) and the README for the project.

[Unreleased]: https://github.com/MrChartist/global-stock-logos/compare/f6183d1...HEAD
