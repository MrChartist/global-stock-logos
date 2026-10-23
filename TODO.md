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
- [ ] Founding-year disagreements: the 400 largest were resolved on October 23 (274 hand-checked with a source, 63 of them corrected, e.g. Alphabet 1998, BHP 1885, Darden 1938); about 1,100 smaller ones remain in `checks`.
- [ ] 182 entries still have a generated placeholder badge and 20 are PNG only (was 278 and 42 before October 23). The rest are mostly small BSE-only or SME listings whose only logos are rasters (their offer documents too). GMR Airports, Marsh and Intuitive Surgical are done; ICICI Bank and Asian Paints still lack an HD logo (only white-only or partly raster versions exist).
- [ ] Check data terms before wide public use: Eastmoney is an unofficial endpoint, and exchange feeds may limit redistribution (see DATA-SOURCES.md). TradingView logo terms are also unconfirmed.

## 3b. Brands and logos (see docs/BRANDS.md)

- [x] **Wikimedia retry** (October 23): 235 files downloaded; after review, 134 brands and 68 HD logos added (CDSL and BSE among them). Still missing for lack of a usable vector: Tata Technologies, Grasim, Adani Green, Tencent HD, Buick, Denza, Stella Artois, Carlsberg, Palmolive, Sky, Peter England.
- [x] **NSDL and LIC HD logos** (October 23): NSDL's vector came from an official 2026 NSDL brochure, LIC's from its 2025-26 annual report.
- [x] **Indian market institutions** (October 23): 68 regulators, government bodies, exchanges, depositories, payment systems and industry bodies in `institutions/` (SEBI, RBI, NSE, BSE, NSDL, CDSL, NPCI, UPI, RuPay, IRDAI, PFRDA, AMFI...). About 60 more were researched but have no usable official logo yet (no vector and no raster of 1,000 px).
- [x] **Indian brands by company** (October 23): 16 jobs, every brand reviewed; brand catalogue 575 → 847. Each brand is linked to its ultimate listed owner, with the Indian listed company in `otherListedOwners` (Surf Excel → UK:ULVR + IN:HINDUNILVR).
- [ ] **Indian brands still missing**, because the official logo only exists as a raster under 1,000 px, as pack art, or the site blocks downloads: HUL (Vim, Lux, Rin, Wheel, Pond's, Pears, Closeup, Kissan, Bru, Lipton, Kwality Wall's), ITC (Bingo!, Yippee!, Fiama, Mangaldeep), Nestle (Munch, Milkybar, Cerelac), Britannia (Good Day, NutriChoice, 50-50), Cadbury Dairy Milk, Bournvita, PepsiCo (Kurkure, Doritos, Quaker), Dabur (Red, Hajmola, Real), Marico (Parachute, Saffola), Emami (BoroPlus, Zandu), Jyothy (Ujala, Henko), Tata Consumer (Tata Tea, Tata Salt, Tata Sampann, Tetley), AWL (Fortune; check ownership: Adani exited in 2025, Wilmar may be the owner), Asian Paints (Royale, Apex), Pidilite (Fevikwik, M-Seal: logos under 1,000 px), Havells (Lloyd, Crabtree), Mahindra (Thar, Scorpio, XUV), Hero (Splendor), Maruti (Swift, Dzire, Brezza), United Spirits (McDowell's, Royal Challenge), Kingfisher, Van Heusen, Allen Solly, Peter England, Nykaa brands, Indane, Servo, Bharatgas, HP Gas, P&G (Vicks, Whisper, Ariel), Palmolive, Amazon Pay, Google Pay (current redesign), Flipkart (current logo).
- [x] EIH and Lemon Tree HD logos added; EIH's wrong PNG removed. MakeMyTrip HD: no official file reachable yet (the Wikipedia SVG comes from an aggregator).
- [x] **Round 4** (October 23): 24 more brands (Maruti, Royal Enfield and Mahindra models from brochures and annual reports; Havells' Lloyd, Standard, REO; Pigeon, Gilma, M-Seal, Daawat, Lux, Flipkart, Google Pay), 6 more institutions (MSE, NPCI International, NPS Trust, ECGC, Sa-Dhan, Payments Council of India), and sourced facts (aliases, founded, country; headquarters and legal basis for institutions) for about 750 brands and all institutions. The API gained `entities.json`, linked `owners`/`children`, and the client `find()`.
- [ ] Brand owners to re-check: Fortune and Kohinoor are now Wilmar's (SINGAPORE:F34, 56.9 % of AWL; Adani exited) — add when a usable logo exists; Paramount brands (MTV, Nickelodeon, Paramount+, Pluto TV) and the Warner Bros. Discovery brands sit under US:SKYD (see the SKYD/PSKY item below); Listerine, Tylenol, Neutrogena, Band-Aid, Aveeno, Johnson's under US:KVUE until the Kimberly-Clark deal closes; Kraft Heinz split.
- [ ] Institutions still without a usable logo: the Government of India ministries and departments (they use the State Emblem with plain text), ICAI, ICSI, CAG, IPPB, PIB, GSTN, GeM, India Post, NABARD, NHB, EPFO, CCI, ASSOCHAM, PHDCCI, ICRA (official vector of the 2026 logo), NSE Clearing, ICCL, MCXCCL, the KRAs, CIBIL, IBA, India Ratings, Acuité, Brickwork, Infomerics, BSE StAR MF, NSE NMF. Many of their sites block non-Indian or automated visitors: retry from an Indian network.
- [ ] Outdated main logos with no official vector yet: AMBUJACEM, TORNTPHARM, LODHA, TORNTPOWER (new monogram is PNG only), DALBHARAT, RATEGAIN, KIRLOSENG; NHIT (shows NHAI's emblem), DHOOTTRANS (placeholder). HD gaps: KIOCL (report red differs from the current logo), SHRIPISTON (renamed SPR Auto Technologies; new logo), GMRAIRPORT (PDF vector was degraded).

## 3c. Corporate actions to apply (checked 2026-10-22)

- [x] **Delistings** (October 23): US:WBD (acquired by Skydance, 2026-10-06), US:EA (taken private, 2026-08-04) and US:PSKY (renamed Skydance Corporation, now US:SKYD on NYSE) are marked `listing.status: "delisted"` with their successor; SKYD has the Skydance logo. The catalogue now supports this for any company (`status`, `delistedAt`, `successor` in `curated/overrides.json`).
- [ ] Officer changes already announced (apply on the date): Hexaware CEO Vivek Jetley (28 Oct 2026), Cummins India MD (1 Nov 2026), Adobe CEO (1 Dec 2026), Kotak Mahindra Bank MD & CEO Anup Saha, UltraTech MD Jayant Dua, Manappuram MD & CEO Ashish Singh, Stryker CEO Spencer Stiles, Enbridge CEO Michele Harradence, General Dynamics CEO (all 1 Jan 2027), Waste Management and Enterprise Products CEOs (4 Jan 2027), TVS Motor CEO Peyman Kargar (27 Jan 2027), CME CEO Lynne Fitzpatrick (around Mar 2027).
- [x] **US top 500 officers** (October 23): CEO and chairman hand-checked against SEC filings or company pages for about 290 more large US-listed companies (59 corrections, e.g. Walmart, Coca-Cola, P&G, Intel, T-Mobile, ConocoPhillips, Sanofi); reviewed with no errors found. Officers were then copied to 3,415 duplicate lines of the same issuers (ADRs, preferreds, CEDEARs, BDRs, foreign listings), matched by ISIN, CUSIP, CIK or issuer name and reviewed.
- [x] **Websites** (October 23): all 619 recorded website disagreements resolved; 312 corrected, including 22 parked, hijacked or other-company domains.
- [x] Baroda BNP Paribas Mutual Fund schemes carry the fund house's current logo (from its factsheet).
- [x] **Renamed companies** (October 23): confirmed from filings; the catalogue already had the new names and tickers. Lakefront Biotherapeutics NV gets its legal name; old lines US:MMC (→ MRSH), IN:SMLISUZU (→ SMLMAH) and IN:CIGNITITEC (merged into Coforge) are marked delisted with their successor; new logos for Vivmark, Lakefront, Kyntra, Dauch, Optimum and Grandstand. Still old logos: Nextpower, Filana, SML Mahindra (sites blocked). IN:GUJGASLTD looks like the old line of IN:GUJENERGY (renamed July 2026): mark it once the NSE circular is linked. US:TPC is named as an AT&T preferred but SEC ticker TPC is Tutor Perini: check.
- [ ] Brand owners to re-check when deals close (status checked 2026-10-23): Kenvue → Kimberly-Clark (expected Q4 2026), Castrol → Stonepeak 65 % (expected end 2026), Unilever Foods incl. Knorr and Hellmann's → McCormick (mid-2027; India excluded), Apollo 24|7 demerger listing (Jan–Mar 2027). Kraft Heinz split is paused; Costa Coffee has no deal; PhonePe IPO on hold.
- [x] PNG sizes now cover the 3,000 largest companies by home listing (cut-off about $8B; before, cross-listings filled the list and the cut-off was about $97B).

## 4. Product and code

- [ ] Run the full pipeline on a schedule from the VPS: `npm run all` (resumable; exit 0 complete, 2 run again, 1 a check failed). Under `tmux` or `cron`; it takes hours.
- [x] `CLAUDE.md` with the commands, layout and rules, so Claude sessions start with the context.
- [ ] Re-measure Lighthouse on the real host after Pages is on (`npm run lighthouse` measures a local server). Mobile performance is 99; the brand fonts cost about half a second on the simulated slow 4G link.
- [x] The React component (`src/StockLogo.tsx`) and `src/index.ts` are type-checked (`tsconfig.react.json`, part of `npm run typecheck`).
- [ ] The frontend test needs Chromium and is not part of `npm test`; CI runs it in its own job.

## Working from a VPS

```bash
git clone --depth 1 https://github.com/MrChartist/global-stock-logos.git   # about 23 s and 1.1 GB; omit --depth 1 for full history
sudo apt install -y libxml2-utils            # xmllint, for the logo checks
cd global-stock-logos && npm ci && npm test  # Node 22 or newer
npx playwright-core install chromium         # only for npm run test:frontend and npm run lighthouse
```

Always work on a branch and open a pull request; run `npm test` first (CI runs the same). Do not edit generated files by hand (`manifests/`, `api/`, `search-index*.json`, `logos-manifest.json`): run `npm run sync && npm run api`.
