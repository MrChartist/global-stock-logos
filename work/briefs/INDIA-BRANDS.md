# Brief: Indian brands by company (round 3)

Read `/home/user/global-stock-logos/.work/BRIEF.md` first (quality bar, sources, tools, network rules, the October 23 updates and the **Raster fallback** section). This brief tells you what to produce.

Goal: the owner wants **every well-known brand sold in India, grouped under the listed company that owns it** (e.g. all of Hindustan Unilever's brands: Surf Excel, Rin, Lux, Dove, Brooke Bond, Kissan...). Your prompt names your `JOB` and the companies you cover. For each company, list its brands from its **own website / brands page / latest annual report** (the official brand portfolio), then add the ones people in India actually recognise (aim for all of the company's major brands; skip obscure SKUs and variants).

## New brands

As in BRIEF.md part A: logo file `brands/logos/<slug>.svg` (or `.png` per Raster fallback; app brands may use the official 1024 px App Store icon as `<slug>.png` only if no vector wordmark exists), and a record in `.work/out/<JOB>/brands.json`.
- **Parent** = ultimate listed owner in the catalogue; put the Indian listed company in `otherListedOwners` when the parent is foreign (Surf Excel → parent `UK:ULVR`, otherListedOwners `["IN:HINDUNILVR"]`; Whisper → `US:PG` + `IN:PGHH`; Maggi → `SWITZERLAND:NESN` + `IN:NESTLEIND`; NEXA → `JAPAN:7269` + `IN:MARUTI`). Check tickers with `node scripts/logo-tool.js find`.
- **Licensed brands are excluded** (Domino's at Jubilant, Jockey at Page, US Polo at Arvind, Starbucks at Tata, McDonald's at Westlife, KFC/Pizza Hut at Devyani/Sapphire, bottlers like Varun Beverages): the brand belongs to its owner, not the licensee. If the owner is listed (Yum! → US:YUM) you may add it with that parent and no Indian otherListedOwner.
- Brands of **unlisted** owners (Amul, Haldiram's, Zepto, CRED, Tata Sons' unlisted Tata Digital: BigBasket, Croma, 1mg, Tata Neu; Wipro Consumer: Santoor) are skipped; list them in NOTES.md.
- `checkedAt`: "2026-10-23".

## Brands that already exist — do not replace

`.work/jobs/brands-existing-all.tsv` lists every brand already in the catalogue or in another job (slug, name, parent, otherListedOwners, category, website). **Never write a logo file for a slug that is listed there or already exists in `brands/logos/`**, and never change its logo or parent. Instead, if an existing brand of your companies lacks details, add them in `.work/out/<JOB>/brand-updates.json` (an object keyed by slug):

```json
{ "lakme": { "otherListedOwners": ["IN:HINDUNILVR"], "category": "Beauty", "description": "…", "website": "https://www.lakmeindia.com", "ownershipSource": "https://www.hul.co.in/brands/…" } }
```

Only these fields: `otherListedOwners`, `category`, `description`, `website`, `wikidata`, `brandColor`, `ownershipSource`. Missing fields are filled; existing values are kept. If you believe an existing brand's **parent is wrong**, put `"parent": "<correct>"` with `ownershipSource` and explain in NOTES.md (it is reported for review, not applied).

## Logo quality (owner will use these in presentations)

Vector first (brand site header/inline SVG, brand-portfolio page on the parent's site, press kit, annual-report PDF if the logo is vector inside it, Wikimedia Commons). Official raster ≥ 1,000 px only when no vector exists. Current design, full logo (not cropped), official colours. Look at every file (preview). Use the central Wikimedia queue (`.work/wm-queue/<JOB>.tsv`) on a 429. Product pack shots, ads and photos are not logos.

## Finish

As BRIEF.md: check every SVG, size every PNG, JSON parses, NOTES.md (companies covered, brands added per company, brands skipped and why: licensed, unlisted owner, no usable logo). Final answer: counts per company (new, updated, missing) in one short paragraph.
