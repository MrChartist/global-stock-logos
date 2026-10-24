# Roadmap: from a good dataset to something you can build websites on

Audit of 2026-10-24, measured on `main` (80,891 company files, 68 markets, 871 brands, 74 institutions). Numbers come from `api/v1/`, `quality-report.json` and the test suite. `TODO.md` stays the short list of next tasks; this page says why and in what order.

## Where it stands

`npm test` and the page test (22 checks) pass, and the generated files are in sync. The engineering is sound. What limits use on a public website is **trust in the logos** and **depth outside the largest companies**.

| Area | Score | Why |
| :--- | :--- | :--- |
| Catalogue page and design system | 85% | Lighthouse 99–100, light and dark, keyboard, deep links. Missing: a reusable component for other sites. |
| API, schema, typed client | 80% | Static, versioned, typed, tested. Missing: lookup by ISIN, a pinned release, a changelog. |
| Logo coverage | 85% | 80,420 SVG for 80,439 listings; 177 are generated initials badges (flagged `isPlaceholder`). |
| **Logo provenance and rights** | **40%** | Almost all logos come from TradingView's symbol-logo service (`DATA-SOURCES.md`, terms unconfirmed). `logo-sources.json` records only 3 entries. Your own rule in `CLAUDE.md` forbids that source for new logos. |
| **Logo fidelity** | **55%** | Official HD logos exist for 740 companies (about 1%). The rest are square icons of mixed quality; no dark-mode variant. |
| Data depth, top 500 | 85% | CEO 95% (hand-checked, sourced), employees 86%, website 67%, founded 56%, headquarters 56%. |
| Data depth, long tail | 30% | Over all 80,891: website 42%, founded 38%, headquarters 38%, CEO 18% (8% high confidence). Vietnam, Bangladesh, Malaysia, Pakistan, Turkey, Korea, Thailand are near 0–10% for website. |
| Release and operations | 50% | No release or tag (users pin `@main`), Pages off, workflows unobserved, 800 MB repository on one CDN. |
| Adopter documentation | 60% | API docs are good. No "use this in production" guide, no component recipes, no changelog. |

Overall about **65%**, which matches your own 60–80% estimate.

## Principles

1. Correct beats many (from `CLAUDE.md`). Every improvement below makes a value more trustworthy before it makes the set bigger.
2. Say what is not known. A website must be able to tell an official logo from a crawled one, and a checked CEO from a Wikidata guess.
3. One change, one test. Each item ships as a small branch with `npm test` green and generated files regenerated.

## Phase 0: make it safe to depend on (days)

Owner-only steps are marked (owner).

- [ ] **Tag a release** and publish the `data-YYYY-MM` tag from the monthly workflow, so sites pin a version instead of `@main`. Document the pin in `docs/API.md`.
- [ ] (owner) Enable GitHub Pages, fix the repository description, delete merged branches automatically, watch the first runs of the three workflows.
- [x] **A "using this in production" page** ([PRODUCTION.md](./PRODUCTION.md)): pin a version, cache headers, fallback image, attribution and takedown contact, what `confidence` means, what `isPlaceholder` means, how fresh market data is.
- [x] **Decide the rights position for crawled logos** (see Phase 1). Until then, document it plainly in the README instead of one sentence at the end.
- [x] Keep numbers consistent: README says 75,000+, `CLAUDE.md` 79,000+, the manifest 80,439 listings. Pick one definition (listings with a logo) and generate it.

## Phase 1: logo trust and quality (weeks 1–4) — the biggest gap

Goal: for the logos a website actually shows, every one is official and labelled as such.

- [x] **Provenance field** (done: `logo.provenance` and `logo.provenanceSource` in the API, `logoProvenance` counts in `index.json`, sourced entries in `curated/logo-provenance.json`; today 0 official, 3 commons, 80,256 crawled, 180 generated — the work now is moving logos out of `crawled` with evidence). Add `logo.provenance` to the API: `official-vector`, `official-raster`, `commons`, `crawled` (TradingView), `generated`. Record it per logo in a generated table (extend `logo-sources.json`; today it has 3 entries). Sites can then show only `official-*` and `commons`, and fall back for the rest.
- [ ] **Replace crawled logos by official ones, largest first.** Same rules as `CLAUDE.md`: owner's own site, official document or Wikimedia Commons, looked at one by one. Tiers: top 500 by market cap, then 3,000, then each market's index constituents (Nifty 500, S&P 500, FTSE 350, DAX, CAC, Nikkei 225, KOSPI 200, TOPIX 100…). Track progress as a percentage per tier with `npm run tiers`.
- [ ] **HD for the top 3,000** (now 740 companies). Finish the India batches in `work/`, then the US and Europe indices.
- [ ] **Dark-mode variants.** Detect logos that vanish on a dark page (black or very dark marks) and add `logo.onDark` (an official light version, or a flag telling the site to put the logo on a light tile). Add it to `logo-tool.js check`.
- [ ] **Consistent framing.** One padding and aspect rule for square icons, so a grid of 50 logos looks even. Add a visual regression sheet (contact sheet of 200 random logos per release, looked at before tagging).
- [ ] Clear the 177 badges and 19 PNG-only entries where an official vector exists; keep the badge only for the rest, and keep it visibly generic.

## Phase 2: data depth where it matters (weeks 2–8)

- [x] **Freshness on every officer.** Add `asOf` to CEO and chairman and a monthly job that lists values older than 12 months for re-check. A site should be able to say "as of Oct 2026".
- [ ] **Korea** (needs a free DART key), **South-East Asia, Turkey, Pakistan, Bangladesh, Vietnam**: one adapter per market, tested from a GitHub runner, 40 records checked against a second source (the method in `docs/ADAPTERS.md`).
- [ ] **India BSE-only companies** (about 3,000): an adapter or the hand-over lists in `work/jobs/`.
- [ ] Target for the top 3,000: website 90%, founded 85%, headquarters 85%, CEO high-confidence 90%. Publish the per-market scorecard in `docs/DATA-COVERAGE.md` from a script, not by hand.
- [ ] **Re-key renamed tickers** (ICICIPRULI→ICICILIFE, VTAK→VJET) and fix the key collisions listed in `TODO.md`. Wrong identity is worse than a missing field.
- [ ] Check redistribution terms for Eastmoney and exchange feeds before wide public use (open item in `TODO.md`).

## Phase 3: developer experience (weeks 3–6)

- [x] **Lookup by identifier**: `api/v1/isin/<ISIN>.json` and `api/v1/lookup/<exchange>-<ticker>.json`, so a site that holds an ISIN or a Yahoo symbol needs no search.
- [x] **A web component** `<stock-logo symbol="in:TCS" size="32">` (and the existing React one) with lazy loading, a fallback badge, and `theme="auto"` that uses the dark-mode variant. Zero dependencies, one file.
- [ ] **npm package** with the client and types, versioned with the data tags.
- [ ] **A second CDN path** (GitHub Pages, or Cloudflare in front) and a client `baseUrl` fallback, since the repository is about 800 MB and sits on one CDN. Confirm jsDelivr's limits for a repository this size before it matters.
- [x] **Changelog and diff report** per monthly refresh: companies added, removed, renamed, CEOs changed, logos replaced.
- [ ] Per-market bundles (one JSON per market, already in `manifests/`) documented for sites that want an offline list.

## Phase 4: design for your websites (weeks 4–8)

- [x] **Export the design system as tokens** (`assets/tokens.css` and `tokens.json`) generated from `assets/style.css`, so your other sites use the same values as `docs/DESIGN.md`.
- [x] **Reusable parts**: company card, logo grid, detail sheet, search box, as plain CSS and a small script, documented with copy-paste examples in `docs/INTEGRATIONS.md`.
- [x] **Brand colour contrast**: publish a readable text colour (`brandInk`) for every `brandColor`, so badges and chips pass WCAG AA on both themes.
- [ ] **Two example sites**: a screener and a portfolio list, built only from the public API, as a living test of the API.
- [ ] Keep the quality bar: Lighthouse at 95 or more in CI, and extend the page test to cover each new component.

## Phase 5: upkeep and governance (ongoing)

- [x] A takedown and correction process: one page, a contact, a target response time, and a log.
- [x] A weekly report of failures: market data older than 7 days, placeholders added, validation warnings.
- [x] A pull-request check that rejects logos from forbidden sources (domain list from `CLAUDE.md`) and logos that fail `logo-tool.js check`.

## Order of work

1. Phase 0, all of it, this week.
2. Provenance field (Phase 1, first item): it is small, it unblocks every later decision, and it tells you today how many logos are safe to show.
3. Official logos for the top 500, then ISIN lookup and the web component (they are independent and can run in parallel).
4. Data adapters market by market, starting with the largest market where website coverage is under 10%.

## What to decide

- **Rights position for crawled logos.** Options: keep them, labelled `crawled`, with the takedown process; show only `official` and `commons` on your own sites; or replace them tier by tier. This sets how much of Phase 1 is needed before launch.
- **Which markets matter for your sites first.** The adapters in Phase 2 are per market; starting with the wrong one wastes the most effort.
