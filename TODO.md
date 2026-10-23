# TODO

Open work, in the order to do it. Tick a box when it is done and merged. Last updated 2026-10-22.

## 1. Settings only the owner can change (GitHub)

- [ ] Delete the old merged branch `claude/affectionate-wozniak-viz7s4` (`git push origin --delete claude/affectionate-wozniak-viz7s4`), then turn on **Settings, General, Automatically delete head branches**.
- [ ] Update the repository description. It still says "1,180+ equities"; it should say 75,000+ listed companies in 68 markets, with a static JSON API.
- [ ] Enable GitHub Pages (deploy from `main`, root). The catalogue page, `index.html`, is ready to serve; `.nojekyll` is in place.
- [ ] Watch the first runs of the three workflows. None has run yet except the old daily sync: `ci.yml` (including the page test and Lighthouse job, which fails below 95), `daily-sync.yml`, `monthly-refresh.yml`.
- [ ] Publish a release or tag, so users can pin a stable version of the data instead of `@main` (see docs/API.md).

## 2. Data coverage (see docs/DATA-COVERAGE.md for what each field can reach)

Weakest markets today: India (website 4%, location 21%), Korea (website 8%), Thailand, Brazil (addresses 5%), Argentina.

- [ ] **Korea.** Needs a free DART API key (opendart.fss.or.kr) in an environment variable such as `DART_API_KEY`. DART gives website, CEO, address and founding date. KIND was blocked from the build sandbox: test it from the VPS first.
- [x] **India.** `scripts/adapters/nse-filings.js` reads every NSE company's latest governance filing and BRSR: chairperson, CEO/MD, website, year of incorporation, office address, employees. It runs with `node scripts/enrich-exchanges.js --markets in` and in the monthly pipeline. Still open: BSE-only companies (about 3,000 small companies) have no equivalent yet.
- [ ] **South-East Asia.** Thailand (SET, behind bot protection in the sandbox), Malaysia, Indonesia, Singapore, Vietnam, Philippines.
- [ ] **Europe.** Germany and the UK are the largest gaps in website; look at exchange and open company registers (see docs/DATA-COVERAGE.md).
- [ ] **Rest of the world.** Japan, Taiwan main board (TWSE was blocked), Mexico, Turkey, Israel, the Gulf, South Africa, Argentina, Chile, Colombia, NZ, Pakistan.
- [ ] **Slogans** are not in any open data. Add the ones you want, with a source link, in `curated/overrides.json`.

How to add a source: one adapter file per source in `scripts/adapters/`, following [docs/ADAPTERS.md](./docs/ADAPTERS.md). Verify identity before writing (ISIN, or exchange code plus a close name), fill only empty fields, test on a sample, read the output, then run the market. One agent per market, followed by an independent check of about 40 written records against another source, worked well; unverified output must not be committed.

## 3. Data quality

- [ ] **Stale CEOs.** The CEO from Wikidata can be years out of date. India's 400 largest companies, Korea's 100 largest and about 70 large US and global companies now have hand-checked CEO and chairman with source links (`curated/overrides.json`, `confidence: "high"`). The rest still carry the low-confidence Wikidata value. Next: extend the same check to the next 400 Indian companies and the US top 500 (NSE governance filings and SEC 8-K item 5.02 worked well).
- [ ] Review the 586 website and 1,323 founding-year disagreements recorded in `checks` (many are harmless: investor-relations subdomains, incorporation versus founding year).
- [ ] 278 entries have a generated placeholder badge (16 of them since October 2026, when their PNG turned out to be another company's logo or a parked-domain ad) and 42 logos are still PNG only. Replace with official vector logos (`node scripts/logo-tool.js` checks and previews them).
- [ ] Check data terms before wide public use: Eastmoney is an unofficial endpoint, and exchange feeds may limit redistribution (see DATA-SOURCES.md). TradingView logo terms are also unconfirmed.

## 3b. Brands and logos (see docs/BRANDS.md)

- [x] **Wikimedia retry** (October 23): 235 files downloaded; after review, 134 brands and 68 HD logos added (CDSL and BSE among them). Still missing for lack of a usable vector: Tata Technologies, Grasim, Adani Green, Tencent HD, Buick, Denza, Stella Artois, Carlsberg, Palmolive, Sky, Peter England.
- [x] **NSDL and LIC HD logos** (October 23): NSDL's vector came from an official 2026 NSDL brochure, LIC's from its 2025-26 annual report.
- [x] **Indian market institutions** (October 23): 68 regulators, government bodies, exchanges, depositories, payment systems and industry bodies in `institutions/` (SEBI, RBI, NSE, BSE, NSDL, CDSL, NPCI, UPI, RuPay, IRDAI, PFRDA, AMFI...). About 60 more were researched but have no usable official logo yet (no vector and no raster of 1,000 px).
- [x] **Indian brands by company** (October 23): 16 jobs, every brand reviewed; brand catalogue 575 → 847. Each brand is linked to its ultimate listed owner, with the Indian listed company in `otherListedOwners` (Surf Excel → UK:ULVR + IN:HINDUNILVR).
- [ ] **Indian brands still missing**, because the official logo only exists as a raster under 1,000 px, as pack art, or the site blocks downloads: HUL (Vim, Lux, Rin, Wheel, Pond's, Pears, Closeup, Kissan, Bru, Lipton, Kwality Wall's), ITC (Bingo!, Yippee!, Fiama, Mangaldeep), Nestle (Munch, Milkybar, Cerelac), Britannia (Good Day, NutriChoice, 50-50), Cadbury Dairy Milk, Bournvita, PepsiCo (Kurkure, Doritos, Quaker), Dabur (Red, Hajmola, Real), Marico (Parachute, Saffola), Emami (BoroPlus, Zandu), Jyothy (Ujala, Henko), Tata Consumer (Tata Tea, Tata Salt, Tata Sampann, Tetley), AWL (Fortune; check ownership: Adani exited in 2025, Wilmar may be the owner), Asian Paints (Royale, Apex), Pidilite (Fevikwik, M-Seal: logos under 1,000 px), Havells (Lloyd, Crabtree), Mahindra (Thar, Scorpio, XUV), Hero (Splendor), Maruti (Swift, Dzire, Brezza), United Spirits (McDowell's, Royal Challenge), Kingfisher, Van Heusen, Allen Solly, Peter England, Nykaa brands, Indane, Servo, Bharatgas, HP Gas, P&G (Vicks, Whisper, Ariel), Palmolive, Amazon Pay, Google Pay (current redesign), Flipkart (current logo).
- [ ] Salvaged by the media review: an official MakeMyTrip SVG could become `logos-hd/us/MMYT.svg`, and Lemon Tree's official PNG `logos-hd/in/LEMONTREE.png` (`.work/tmp/verify-ibmte/salvage/`). Main logos that look wrong: `logos/in/EIHOTEL.png` (a blue "S"), `logos/in/LEMONTREE.png` (low resolution).
- [ ] Outdated main logos with no official vector yet: AMBUJACEM, TORNTPHARM, LODHA, TORNTPOWER (new monogram is PNG only), DALBHARAT, RATEGAIN, KIRLOSENG; NHIT (shows NHAI's emblem), DHOOTTRANS (placeholder). HD gaps: KIOCL (report red differs from the current logo), SHRIPISTON (renamed SPR Auto Technologies; new logo), GMRAIRPORT (PDF vector was degraded).

## 3c. Corporate actions to apply (checked 2026-10-22)

- [ ] **US:WBD** was acquired by Paramount Skydance and delisted (closed 2026-10-06); retire it. **US:PSKY** is the old ticker of **US:SKYD** (Skydance Corporation): merge them and give SKYD the new logo.
- [ ] **US:EA** was taken private (closed 2026-08-04); retire it.
- [ ] Officer changes already announced: Hexaware CEO Vivek Jetley (28 Oct 2026), Cummins India MD (1 Nov 2026), Kotak Mahindra Bank MD & CEO Anup Saha (1 Jan 2027), UltraTech MD Jayant Dua (1 Jan 2027), Manappuram MD & CEO Ashish Singh (1 Jan 2027), TVS Motor CEO Peyman Kargar (27 Jan 2027), CME CEO Lynne Fitzpatrick (around Mar 2027). Confirm ICICI Life CEO Sidharatha Mishra's IRDAI approval.
- [ ] Brand owners to re-check when deals close: Knorr (Unilever to McCormick), Castrol (BP to Stonepeak, 65 %), Kenvue brands (to Kimberly-Clark), NBCUniversal and Sky (Comcast spin-off), Apollo 24|7 (Apollo Healthtech listing, 2027).
- [x] PNG sizes now cover the 3,000 largest companies by home listing (cut-off about $8B; before, cross-listings filled the list and the cut-off was about $97B).

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
