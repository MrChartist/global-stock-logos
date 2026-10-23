# Global Stock Logos

Logos and profiles for 79,000+ listed companies in 68 markets, plus brands and market institutions, served as plain files by jsDelivr: a static JSON API (`api/v1/`), SVG/PNG logos, a catalogue page (`index.html`) and a zero-dependency JS client (`src/client.js`). Read `README.md`, `docs/API.md` and `docs/BRANDS.md` for the data model; `TODO.md` is the work list.

## Commands

```bash
npm ci                     # Node 22+
npm test                   # quality, brand, institution, data and API checks, type check, client test (CI runs the same)
npm run test:frontend      # Playwright page test (needs Chromium; not in npm test)
npm run sync && npm run api   # regenerate manifests, search index and api/v1 after changing data or logos
npm run brands             # validate brands/brands.json, render brand PNGs
npm run institutions       # validate institutions/institutions.json, render institution PNGs
npm run png                # PNG sizes for the 3,000 largest companies
npm run types              # regenerate src/client.d.ts after changing the JSDoc in src/client.js
node scripts/logo-tool.js check <file.svg> --fix   # clean, add viewBox, namespace ids, validate
node scripts/logo-tool.js preview <file.svg> <out.png> 512   # render on white and dark, then look at it
node scripts/logo-tool.js find "IN:LICI"           # is a company in the catalogue?
```

## Layout

- `logos/<market>/<TICKER>.svg` square icon; `logos-hd/<market>/<TICKER>.svg|png` official full logo.
- `brands/` brand registry, logos, PNGs; `institutions/` regulators, exchanges, payment systems and other market bodies.
- `curated/overrides.json` hand-checked facts with a `sources` URL per field (they win over automatic data); `curated/aliases.json` renamed tickers.
- `enrichment/` adapter output; `scripts/adapters/` data sources (NSE filings, exchanges, registries).
- Generated, never edited by hand: `manifests/`, `api/`, `search-index*.json`, `logos-manifest.json`, `companies-metadata.json`, `png/`.

## Rules

- Correct beats many. A logo must be the current official design (vector preferred; an official raster of at least 1,000 px after trimming only when no vector exists), from the owner's own site, an official document or Wikimedia Commons. Never redraw, trace, upscale, recolour, or use TradingView, Clearbit, Brandfetch or logo aggregator sites. Look at every logo you add.
- Every fact needs a source URL; unknown stays `null`. Officers change: CEO and chairman come from the company's own page or a recent filing.
- A brand's `parent` is its ultimate listed owner; an Indian listed subsidiary of a foreign group goes in `otherListedOwners`. Licensed brands belong to the licensor.
- Logos containing the State Emblem of India carry a `usageNote`.
- Work on a branch, run `npm test` before pushing, and keep generated files in sync with `npm run sync && npm run api`.
