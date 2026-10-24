# Brief: round 4 — missing logos, more institutions, and facts

Read `/home/user/global-stock-logos/.work/BRIEF.md` (quality bar, sources, tools, network rules, **Raster fallback**) and, for brand jobs, `.work/INDIA-BRANDS.md`; for institution jobs, `.work/INSTITUTIONS.md`. This brief adds to them. Never run git commands that change state. Only write files your job owns.

## Lessons from round 3 (reviewers removed these — do not repeat)

- **Raster size is measured after trimming empty space**: `sharp(f).trim().toBuffer({resolveWithObject:true})` → `info.width/height`; the long side must be ≥ 1,000 px. A 1,200 px canvas with an 800 px logo fails. App brands may use the official 1024 px App Store icon (from apps.apple.com, the real publisher's listing).
- No upscaled or JPEG-noisy files (look at 100 %). No Commons "own work" re-drawings or auto-traces (check the file page's author/source). No product-variant lockups ("Shelcal 500") when the brand logo exists. No old designs: compare with the brand's site **today**.
- A brand that is the listed company's own identity (same logo as `logos/<mk>/<T>.svg` / `logos-hd/`) is not a brand.

## Where the logos are (what worked in round 3)

1. **Vector inside official PDFs**: annual reports (NSE: `https://www.nseindia.com/api/annual-reports?index=equities&symbol=<SYM>`, browser UA + Referer `https://www.nseindia.com/`), investor presentations, brand brochures and product catalogues on the company's own site. Copy the vector paths of the logo region unchanged (a working extractor is `.work/tmp/raster-hd-b/pdfvec.py`; read it first, run with `python3 -I`). Render the same region with `pdftocairo -png -r 300` and compare; no photo fragments, no missing holes (fill-rule), no background boxes that are not part of the logo.
2. Brand websites: header `<svg>` inline, `.svg` in HTML/CSS/JS bundles, `srcset`/`@2x`/`@3x`, `/wp-content/uploads/` originals without size suffix, press/media kits, brand-guideline PDFs.
3. Wikimedia Commons only when the file page's source is the brand/company (not "own work" redraws); queue downloads in `.work/wm-queue/<JOB>.tsv` (the central downloader fetches them).

## Facts (all jobs that write records)

New optional fields, each **with a source URL** in `factSources`, or omitted:

| Field | Brands | Institutions | Meaning |
|---|---|---|---|
| `aliases` | ✓ | ✓ | Other names people search for: short forms, old names, local-script names (e.g. `["HUL"]`, `["Bharat Petroleum"]`, `["भारतीय रिज़र्व बैंक"]`). No source needed. |
| `founded` | ✓ | ✓ | Year the brand was launched / the institution was established (integer). |
| `country` | ✓ | – | ISO 3166 alpha-2 country where the brand originated, not where it is sold (Lux → `GB`, launched by Lever Brothers in the UK; Fevicol → `IN`; Maggi → `CH`). |
| `headquarters` | – | ✓ | `"Mumbai, Maharashtra, India"` |
| `legalBasis` | – | ✓ | The act or order that set it up, e.g. `"Securities and Exchange Board of India Act, 1992"` |

`"factSources": { "founded": "https://…", "country": "https://…" }` — a URL you opened that states the value (the brand's/institution's own site, an annual report, an act on indiacode.nic.in, Wikipedia cross-checked with an official page, or Wikidata P571/P495/P159 cross-checked). A wrong value is worse than none.

- **New records** carry these fields directly.
- **Existing brands**: put them in `.work/out/<JOB>/brand-updates.json` (keyed by slug; fields `aliases`, `founded`, `country`, `factSources`, plus the round-3 fields `wikidata`, `description`, `website`, `category`, `brandColor`, `otherListedOwners`, `ownershipSource`). Missing values are filled; existing values are kept.
- **Existing institutions**: `.work/out/<JOB>/institution-updates.json` (keyed by slug; `aliases`, `founded`, `headquarters`, `legalBasis`, `factSources`, `wikidata`, `description`, `website`).

Current records: `brands/brands.json`, `institutions/institutions.json`. Wikidata SPARQL works (`https://query.wikidata.org/sparql?format=json&query=…`, one big query rather than many small ones).

## Finish

`logo-tool check` on every SVG, trimmed size of every PNG, JSON parses, NOTES.md (what you added, what is still missing and why). Final answer: one short paragraph with counts.
