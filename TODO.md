# TODO

Open work, in the order to do it. Tick a box when it is done and merged. Last updated 2026-10-04.

## 1. Settings only the owner can change (GitHub)

- [ ] Delete the old merged branch `claude/affectionate-wozniak-viz7s4` (`git push origin --delete claude/affectionate-wozniak-viz7s4`), then turn on **Settings, General, Automatically delete head branches**.
- [ ] Update the repository description. It still says "1,180+ equities"; it should say 75,000+ listed companies in 68 markets, with a static JSON API.
- [ ] Enable GitHub Pages (deploy from `main`, root). The catalogue page, `index.html`, is ready to serve; `.nojekyll` is in place.
- [ ] Watch the first runs of the three workflows. None has run yet except the old daily sync: `ci.yml` (including the page test and Lighthouse job, which fails below 95), `daily-sync.yml`, `monthly-refresh.yml`.
- [ ] Publish a release or tag, so users can pin a stable version of the data instead of `@main` (see docs/API.md).

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

- [ ] **Stale CEOs.** The CEO from Wikidata can be years out of date (Tata Consultancy Services still shows a CEO who left in 2023). It is labelled low confidence, but not corrected. Options: drop Wikidata officers older than a set age, or take them from an exchange or registry.
- [ ] Review the 586 website and 1,323 founding-year disagreements recorded in `checks` (many are harmless: investor-relations subdomains, incorporation versus founding year).
- [ ] 25 real companies still have a generated placeholder badge, and 107 older logos are PNG only (`quality-report.json`). Replace with official logos.
- [ ] Check data terms before wide public use: Eastmoney is an unofficial endpoint, and exchange feeds may limit redistribution (see DATA-SOURCES.md). TradingView logo terms are also unconfirmed.

## 4. Product and code

- [ ] Run the full pipeline on a schedule from the VPS: `npm run all` (resumable; exit 0 complete, 2 run again, 1 a check failed). Under `tmux` or `cron`; it takes hours.
- [ ] Add `CLAUDE.md` with the commands, rules and this list, so Claude sessions on the VPS start with the context.
- [ ] Re-measure Lighthouse on the real host after Pages is on (`npm run lighthouse` measures a local server). Mobile performance is 99; the brand fonts cost about half a second on the simulated slow 4G link.
- [ ] The React component (`src/StockLogo.tsx`) is not type-checked; add it to the type check.
- [ ] The frontend test needs Chromium and is not part of `npm test`; CI runs it in its own job.

## Working from a VPS

```bash
git clone --depth 1 https://github.com/MrChartist/global-stock-logos.git   # about 23 s and 1.1 GB; omit --depth 1 for full history
sudo apt install -y libxml2-utils            # xmllint, for the logo checks
cd global-stock-logos && npm ci && npm test  # Node 22 or newer
npx playwright-core install chromium         # only for npm run test:frontend and npm run lighthouse
```

Always work on a branch and open a pull request; run `npm test` first (CI runs the same). Do not edit generated files by hand (`manifests/`, `api/`, `search-index*.json`, `logos-manifest.json`): run `npm run sync && npm run api`.
