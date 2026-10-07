# TODO

Open work, in the order to do it. Tick a box when it is done and merged. Last updated 2026-10-07.

## 1. Settings only the owner can change (GitHub)

- [ ] Delete the old merged branch `claude/affectionate-wozniak-viz7s4` (`git push origin --delete claude/affectionate-wozniak-viz7s4`), then turn on **Settings, General, Automatically delete head branches**.
- [ ] Update the repository description. It still says "1,180+ equities"; it should say 75,000+ listed companies in 68 markets, with a static JSON API.
- [ ] Enable GitHub Pages (deploy from `main`, root). The catalogue page, `index.html`, is ready to serve; `.nojekyll` is in place.
- [ ] Watch the first runs of the three workflows. None has run yet except the old daily sync: `ci.yml` (including the page test and Lighthouse job, which fails below 95), `daily-sync.yml`, `monthly-refresh.yml`.
- [x] Tag stable data: each completed monthly refresh now pushes a `data-YYYY-MM` tag (monthly-refresh.yml). Check that the first one appears after the November run.

## 2. Data coverage (see docs/DATA-COVERAGE.md for what each field can reach)

Weakest markets today: India (website 4%, location 21%), Korea (website 8%), Thailand, Brazil (addresses 5%), Argentina.

- [ ] **Korea.** Needs a free DART API key (opendart.fss.or.kr) in an environment variable such as `DART_API_KEY`. DART gives website, CEO, address and founding date. KIND was blocked from the build sandbox: test it from the VPS first.
- [ ] **India.** The NSE and BSE company APIs returned 403 or 503 from the build sandbox; test from the VPS, with ordinary headers and a polite rate. Needs: website, headquarters, CEO, founding year.
- [ ] **South-East Asia.** Thailand (SET, behind bot protection in the sandbox), Malaysia, Indonesia, Singapore, Vietnam, Philippines.
- [ ] **Europe.** Germany and the UK are the largest gaps in website; look at exchange and open company registers (see docs/DATA-COVERAGE.md).
- [ ] **Rest of the world.** Japan, Taiwan main board (TWSE was blocked), Mexico, Turkey, Israel, the Gulf, South Africa, Argentina, Chile, Colombia, NZ, Pakistan.
- [ ] **Slogans** are not in any open data. Add the ones you want, with a source link, in `curated/overrides.json`.

How to add a source: one adapter file per source in `scripts/adapters/`, following [docs/ADAPTERS.md](./docs/ADAPTERS.md). Verify identity before writing (ISIN, or exchange code plus a close name), fill only empty fields, test on a sample, read the output, then run the market. One agent per market, followed by an independent check of about 40 written records against another source, worked well; unverified output must not be committed.

## 3. Data quality

- [x] **Stale CEOs (rule).** Wikidata CEOs are now picked by rank and start date, ended terms are ignored, ambiguous undated terms give `null`, and the start date is published as `since` (scripts/wikidata-officers.js). In this refresh 131 CEOs changed (for example ICICI Bank, Caterpillar, CVS, Maersk, Novo Nordisk) and 40 ambiguous ones became `null`. TCS is corrected in `curated/overrides.json`.
- [ ] **Stale CEOs (remaining).** About 1,000 of the 3,900 Wikidata CEOs have no start date (`since: null`), so they may be stale. Best fix: an exchange or registry source per market. Second best: correct the largest companies on Wikidata itself (end date on the old term, preferred rank on the new one) and in `curated/overrides.json` with a `_source` note.
- [ ] **Exchange spellings in India.** Some companies appear twice under a stripped ticker and an underscore ticker (MM and M_M for M&M, JKBANK and J_KBANK). The duplicate is now ranked as a secondary listing, but the clean fix is to make the exchange symbol the file name in the crawl and alias the others.
- [ ] Review the 586 website and 1,323 founding-year disagreements recorded in `checks` (many are harmless: investor-relations subdomains, incorporation versus founding year).
- [ ] 266 listings still have a generated placeholder badge (259 in India, mostly funds), and 45 older logos are PNG only (was 107; 58 mislabelled JPEG and WebP files were replaced with real SVGs). See `quality-report.json`. Replace with official logos.
- [ ] Italy: on 2026-10-07 the TradingView scanner stopped returning about 985 Milan cross-listings (1NVDA, 1AAPL ...). They keep their last market data and date (`notInScan`), rank as secondary listings, and drop out of the PNG set. Decide whether to keep these files.
- [ ] Check data terms before wide public use: Eastmoney is an unofficial endpoint, and exchange feeds may limit redistribution (see DATA-SOURCES.md). TradingView logo terms are also unconfirmed.

## 4. Product and code

- [ ] Run the full pipeline on a schedule from the VPS: `npm run all` (resumable; exit 0 complete, 2 run again, 1 a check failed). Under `tmux` or `cron`; it takes hours.
- [x] Add `CLAUDE.md` with the commands, rules and this list, so Claude sessions on the VPS start with the context.
- [ ] Re-measure Lighthouse on the real host after Pages is on (`npm run lighthouse` measures a local server). Mobile performance is 99; the brand fonts cost about half a second on the simulated slow 4G link.
- [x] The React component (`src/StockLogo.tsx`) and `src/index.ts` are type-checked by `npm test`.
- [ ] The frontend test needs Chromium and is not part of `npm test`; CI runs it in its own job.
- [ ] Search by company aliases (Google for Alphabet). Wikidata aliases are in the profiles but not in the search index; adding them costs index size, so measure first.
- [ ] A "Main listings only" and a "Hide placeholder logos" filter on the catalogue page (the index now carries both flags).

## Working from a VPS

```bash
git clone --depth 1 https://github.com/MrChartist/global-stock-logos.git   # about 23 s and 1.1 GB; omit --depth 1 for full history
sudo apt install -y libxml2-utils            # xmllint, for the logo checks
cd global-stock-logos && npm ci && npm test  # Node 22 or newer
npx playwright-core install chromium         # only for npm run test:frontend and npm run lighthouse
```

Always work on a branch and open a pull request; run `npm test` first (CI runs the same). Do not edit generated files by hand (`manifests/`, `api/`, `search-index*.json`, `logos-manifest.json`): run `npm run sync && npm run api`.
