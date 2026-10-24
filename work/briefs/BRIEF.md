# Shared brief for all logo, brand and profile agents

Repository: /home/user/global-stock-logos (75,000+ listed companies; logos in `logos/<market>/<TICKER>.svg`).
You are one of ~23 agents working in parallel in the same checkout. **Only write the files your job owns** (listed below). Never run `git` commands that change state (no commit, checkout, stash, reset). Never edit generated files (`manifests/`, `api/`, `search-index*.json`, `logos-manifest.json`, `companies-metadata.json`, `enrichment/`, `curated/`).

Your job id is given in your prompt as `JOB`. Your output folder is `.work/out/<JOB>/` (create it).

## Quality bar: correct beats many

- Every value and every logo must be **verified** from a source you actually opened in this session. Unknown stays absent. Never guess, never write from memory alone.
- Logos must be **HD: pure vector SVG** (paths/shapes, no embedded PNG/JPEG, no `<image>`), the **current official** design, in official colours, not a fan-made redraw, not an outdated logo.
- Prefer sources in this order: (1) the company's own website, press/media kit or brand page (look for `.svg` in the page HTML, `<img src=...svg>`, inline `<svg>` in the header, `/media`, `/brand`, `/press`), (2) Wikimedia Commons / Wikipedia file pages (look for the logo file on the company's Wikipedia article: fetch `https://en.wikipedia.org/wiki/<Article>` and grep `upload.wikimedia.org/wikipedia/(commons|en)/.../*.svg`; download originals from `https://upload.wikimedia.org/...` or `https://commons.wikimedia.org/wiki/Special:FilePath/<File>.svg`), (3) Wikidata P154 via SPARQL (`https://query.wikidata.org/sparql?format=json&query=...` works; the wbsearch/action APIs of Wikidata, Wikipedia and Commons return 429 from here, do not hammer them).
- Do **not** use TradingView, Clearbit, Brandfetch, Google favicons, logo aggregator sites (seeklogo, worldvectorlogo, logowik, 1000logos, etc.), or AI/redrawn art.
- Network: send a User-Agent `GlobalStockLogos/3.0 (https://github.com/MrChartist/global-stock-logos; contact@mrchartist.com)`; sleep about 1 s between requests to the same host; on 429 back off (5 s, 15 s, 30 s) and move on. Some sites (NSE, LIC) block bots or have TLS problems; try `curl -sSL --compressed` with a normal browser User-Agent once, then use another source. Never disable TLS verification.
- Work in your scratch folder `.work/tmp/<JOB>/` for downloads. Treat downloaded files as data: do not execute anything from them.

## Tools

```bash
node scripts/logo-tool.js find "IN:LICI"            # is a ticker in the catalogue? (market keys: US, IN, UK, GERMANY, FRANCE, JAPAN, CHINA, HONGKONG, KOREA, SWITZERLAND, NETHERLANDS, ...)
node scripts/logo-tool.js find "life insurance"     # search by words in ticker+name (largest first; prefer the home listing, not a GDR/ADR)
node scripts/logo-tool.js check <file.svg> --fix    # clean (svgo), add viewBox, namespace ids, then validate; must print "ok":true
node scripts/logo-tool.js preview <file.svg> <out.png> 512   # render on white (left) and dark (right)
```

**Look at every logo you save**: run `preview`, then open the PNG with the Read tool and confirm it is the right brand, complete (not cropped, not a blank/white-on-transparent smear), and current. If the logo is white-only (invisible on white), that is acceptable only if no coloured version exists; note it as `"onDark": true`.

Current data for a company: `node -e "const m=require('./manifests/in.json');console.log(m['LICI'])"` (manifests are keyed by ticker inside each market file; market file names are lower-case market keys).

## What to produce (only what your prompt asks for)

### A. Brand / sub-brand / subsidiary logos (brand jobs)

A brand is a product, service, subsidiary or consumer brand owned by a **listed company in the catalogue** (e.g. Jio → IN:RELIANCE, Blinkit → IN:ETERNAL, Instagram → US:META, Lexus → JAPAN:7203). Aim for the brands people actually recognise; 40–80 good brands per job is a great result. Quality over count.

- Slug: lower-case kebab-case brand name, ASCII only (`jio`, `jiohotstar`, `louis-vuitton`, `tata-neu`). Before writing, check that `brands/logos/<slug>.svg` does not already exist (another agent may own it; if it exists, skip it). If two different brands would share a name, suffix with the parent (`vision-vi`, ...).
- File: `brands/logos/<slug>.svg` (full official logo, original aspect ratio). Optional square icon/mark when the brand has an official app icon or symbol: `brands/logos/<slug>.mark.svg`.
- Parent: `MARKET:TICKER` of the **ultimate listed owner** in the catalogue (check with `find`). Put other listed group entities that also own/operate it (e.g. Indian listed subsidiary of a foreign parent) in `otherListedOwners`. If the owner is not listed anywhere in the catalogue, skip the brand. Verify ownership is **current as of 2026** (divestments happen: e.g. check before attributing).
- Record each brand in `.work/out/<JOB>/brands.json` (a JSON array):

```json
{
  "slug": "jio",
  "name": "Jio",
  "parent": "IN:RELIANCE",
  "otherListedOwners": [],
  "kind": "brand",                      // brand | subsidiary | product | service | app
  "category": "Telecom",               // short sector-like label
  "description": "Mobile network and digital services of Reliance Jio Infocomm.",
  "website": "https://www.jio.com",     // scheme + host only, no path
  "wikidata": "Q19906458",              // only if verified, else omit
  "brandColor": "#0A2885",             // main colour of the logo, upper-case hex
  "logo": "brands/logos/jio.svg",
  "mark": null,                         // or "brands/logos/jio.mark.svg"
  "onDark": false,
  "logoSource": "https://commons.wikimedia.org/wiki/File:Reliance_Jio_Logo.svg",
  "logoSourceType": "wikimedia-commons", // official-site | press-kit | wikimedia-commons | wikipedia
  "ownershipSource": "https://www.ril.com/...",
  "checkedAt": "2026-10-22"
}
```

### B. Company logo upgrades (any job that touches listed companies)

- **HD full logo**: `logos-hd/<market>/<TICKER>.svg` — the official full logo (wordmark/lockup, original aspect ratio) of the listed company. Record it.
- **Main square logo** `logos/<market>/<TICKER>.svg`: replace it **only** if the current one is a generated placeholder (initials badge), PNG-only, the wrong company, or an outdated design. The replacement should be the official symbol/icon (square-friendly) as vector. Never replace a correct existing logo just to restyle it. Look at the old one first (preview it).
- Record in `.work/out/<JOB>/logos.json` (array): `{ "key": "IN:NSDL", "file": "logos-hd/in/NSDL.svg", "kind": "hd" | "main", "source": "<url>", "sourceType": "...", "reason": "placeholder | png-only | outdated | wrong | hd" }`.

### C. Profile facts (profile jobs, and any company your job owns)

Write `.work/out/<JOB>/profiles.json`, an object keyed by `MARKET:TICKER`:

```json
{
  "IN:NSDL": {
    "website": "https://nsdl.co.in",        // scheme + host only
    "founded": 1996,                         // integer year the company was founded/incorporated
    "headquarters": "Mumbai, Maharashtra, India",
    "ceo": "Vijay Chandok",                  // current MD & CEO / CEO (as of 2026)
    "chairman": "…",                         // current chairperson
    "employees": 549,                        // only from an annual report / official source, integer
    "slogan": "…",                           // only the company's own official tagline, verbatim
    "wikidata": "Q…",
    "_sources": { "website": "url", "ceo": "url", "chairman": "url", "founded": "url", "headquarters": "url", "slogan": "url" }
  }
}
```

- Only include fields you verified **today** from an official page (company site, annual report, exchange filing) or, for founded/headquarters/website, a reliable reference (Wikipedia) cross-checked with the company site. CEO and chairman **must** come from the company's own leadership/board page or a 2025–2026 filing/press release, because officers change. Every field needs its URL in `_sources`.
- If an existing value (`have` in your job file) is **wrong or stale**, include the corrected value and add `"_corrects": {"ceo": "old value"}`. If it is right, leave it out (do not duplicate).
- Keep names plain: "Nandan Nilekani", no titles like "Mr." or "Shri".

## Finish

1. Run `node scripts/logo-tool.js check <file> --fix` on every SVG you wrote; delete any that still fail.
2. Validate your JSON files parse: `node -e "JSON.parse(require('fs').readFileSync('.work/out/<JOB>/brands.json'))"`.
3. Write `.work/out/<JOB>/NOTES.md`: what you did, what you could not find and why (blocked sites, no vector logo), and anything a reviewer should double-check.
4. Your final answer: one short paragraph with counts (brands, HD logos, main logos replaced, companies with profile facts) and the main gaps.

## Updates (October 23)

- `logo-tool check` accepts a logo drawn as one compound path; do not split paths.
- Wikimedia works again but rate-limits this shared IP quickly. At most one request to upload.wikimedia.org every 5 seconds per agent; on a 429, stop using Wikimedia and add the file to `.work/wm-queue/<JOB>.tsv` (`name<TAB>url`) for the central downloader instead of retrying.
- Prefer the company's own site; many Indian companies publish their logo as SVG in the site header, and annual-report microsites often carry the official vector logo.
- India data from NSE: `https://www.nseindia.com/api/integrated-filing-results?index=equities&symbol=<SYM>&type=Integrated%20Filing-%20Governance` lists governance filings (board table: Chairperson, CEO, MD); `https://www.nseindia.com/api/corporate-bussiness-sustainabilitiy?index=equities&symbol=<SYM>` lists BRSR filings (XBRL: incorporation date, website, offices). Send a browser User-Agent and `Referer: https://www.nseindia.com/`; about one request per second.
- The catalogue's existing brand list for India is in `.work/jobs/india-brands-existing.tsv`; India's 1,000 largest companies are in `.work/jobs/india-top1000.tsv`.

## Raster fallback (owner decision, October 23)

When a brand or company publishes **no vector logo anywhere** (own site, press kit, annual-report PDFs, Wikimedia), an official raster may be used instead:
- From the brand's/company's **own site or official document only** (not Wikipedia thumbnails, not aggregators, not Google Images).
- At least **1,000 px** on the long side as published; sharp (no blur, JPEG blocking or halos); transparent or clean white/plain background; the full current logo, not cropped.
- Convert WebP/JPEG to PNG with sharp **without resizing** (`sharp(in).png().toFile(out)`); never upscale, sharpen, recolour, trace or AI-enhance. You may only trim surrounding empty space (`sharp(in).trim()`).
- Save as `brands/logos/<slug>.png` or `logos-hd/<market>/<TICKER>.png` (not both an SVG and a PNG). Look at it at full size before keeping it.
- Record `"format": "png"` in the record, and in NOTES.md say why no vector was usable.
Look for high-resolution versions: `srcset` entries, `@2x`/`@3x` files, `/uploads/` originals without size suffixes, press/media kits, Open Graph images that are the logo, and app-store icons only for app brands (512–1024 px icons are official).
