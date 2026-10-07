# CLAUDE.md

Context for Claude sessions (and any contributor) working in this repository. Read TODO.md for open work.

## What this is

Logos and company profiles for about 77,000 listed companies in 68 markets, served as plain files by jsDelivr:
`logos/<market>/<TICKER>.svg`, PNG sizes in `png/`, a static JSON API in `api/v1/`, a typed client in `src/`, and a
catalogue page (`index.html`, `assets/`). No server, no build step for the page.

## Commands

```bash
npm ci                 # Node 22; also needs xmllint (apt install libxml2-utils) for the logo checks
npm test               # what CI runs: logo check, data validation, API validation, type check, client tests
npm run sync           # rebuild manifests/ and the search indexes (runs the alias repair first)
npm run api            # rebuild api/v1/ from the manifests
npm run all            # the whole resumable pipeline; exit 0 complete, 2 run again, 1 a check failed
npm run test:frontend  # browser test of the catalogue page (needs Chromium)
```

After changing anything that feeds the data, run `npm run sync && npm run api && npm test`.

## Rules

- **Never guess a value.** Unknown is `null` (shown as "Needs verification"). No value is better than a wrong one.
- **Do not edit generated files by hand:** `manifests/`, `api/`, `search-index*.json`, `logos-manifest.json`,
  `png/`, the `*-report.json` files and `pipeline-status.json`. Change the script, then regenerate.
- **Source precedence** (highest first): `curated/overrides.json` (hand-checked, with a `_source` note) > exchange and
  registry sources (recorded in `rec.sources`, medium confidence) > Wikidata matched by ISIN or ticker (no entry in
  `rec.sources`, low confidence) > Wikidata matched by name (`wikidata-name`). A lower source never overwrites or
  clears a higher one; adapters only fill empty fields (`kit.setIfEmpty`).
- **Verify identity before writing:** ISIN equality, or exchange code plus a close name (`similar() >= 0.75`).
- **Dates are honest.** `marketDataAt` is the date of the data itself; `marketCheckedAt` is when we last looked.
  A listing the scanner no longer returns keeps its old data with its old date (`notInScan: true`).
- **Same company, many listings.** `scripts/listings.js` groups listings with an identical logo and a market cap
  within 5%; the home listing is the main one, the rest are `secondaryListing` and rank below main listings in the
  search index and the API market lists. PNGs go to the 3,000 largest companies, not listings.
- **CEOs** come from Wikidata P169 by rank and start date (`scripts/wikidata-officers.js`), with `ceoSince`.
  A stale CEO is fixed in `curated/overrides.json` with a source note, and ideally on Wikidata too.
- **Tickers with special characters and renamed companies** go through `curated/aliases.json` (same ISIN only).
- Work on a branch, run `npm test`, open a pull request. Commit messages: `type(scope): what and why`.

## Where things live

| Path | Purpose |
| :--- | :--- |
| `scripts/markets.js` | The 68 markets: country, TradingView scanner region, Yahoo suffix |
| `scripts/refresh-metadata.js` | Market data (TradingView scanner) and FX conversion to USD and INR |
| `scripts/enrich-*.js`, `scripts/adapters/` | Profile sources; see docs/ADAPTERS.md to add one |
| `scripts/sync.js` | Manifests and search indexes; applies curated overrides |
| `scripts/build-api.js` | The static API, its JSON Schema and OpenAPI document |
| `scripts/validate-*.js`, `scripts/quality.js` | The checks behind `npm test` |
| `.github/workflows/` | `ci.yml` (every PR), `daily-sync.yml` (new listings), `monthly-refresh.yml` (all data, then a `data-YYYY-MM` tag) |

## Keeping it current

The project improves through small, verified steps, and each one leaves a trace:

1. Pick the weakest point from TODO.md or from `npm run coverage` (field coverage per market).
2. Fix it at the source (a script or an adapter), not in generated output.
3. Measure before and after (counts, a sample of about 40 records checked against a second source).
4. Update TODO.md (tick or add items) and the relevant doc in `docs/`.
