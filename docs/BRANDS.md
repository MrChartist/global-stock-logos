# Brands, HD logos and hand-checked profiles

The catalogue covers more than listed companies. People know **Jio, Blinkit, Instagram, Tanishq or Lexus** better than the company that owns them, so the repository also has:

- **Brands**: consumer brands, sub-brands, products, apps and subsidiaries, each linked to its listed owner.
- **HD full logos**: the official full logo (wordmark or lock-up, original aspect ratio) of a listed company, next to its square icon.
- **Hand-checked profile facts**: website, founding year, headquarters, CEO and chairman with a source link for every value.

## Brands

```
brands/brands.json              the registry: one record per brand (hand-curated)
brands/logos/<slug>.svg         official logo, pure vector, original aspect ratio
brands/logos/<slug>.mark.svg    official square symbol or app icon, when the brand has one
brands/png/<size>/<slug>.png    256, 512 and 1024 px PNG (transparent, the logo contained in a square)
```

A record:

```jsonc
{
  "slug": "jio", "name": "Jio", "kind": "brand",        // brand | subsidiary | product | service | app
  "parent": "IN:RELIANCE",                              // the ultimate listed owner (MARKET:TICKER in the catalogue)
  "otherListedOwners": [],                              // listed group companies that also own or run it
  "category": "Telecom", "description": "…",
  "website": "https://www.jio.com", "wikidata": "Q…", "brandColor": "#0A2885",
  "logo": "brands/logos/jio.svg", "mark": null, "onDark": false,   // onDark: a light logo meant for dark backgrounds
  "logoSource": "https://…", "logoSourceType": "official-site",     // official-site | press-kit | wikimedia-commons | wikipedia
  "ownershipSource": "https://…", "checkedAt": "2026-10-22"
}
```

**Rules.** The logo is the brand's current official design, as vector paths (no embedded raster), from the brand's own site, press kit, or Wikimedia Commons / Wikipedia. Not from logo aggregator sites, not redrawn. The parent is the **ultimate listed owner** as of `checkedAt`; an Indian listed subsidiary of a foreign group (for example Hindustan Unilever for Surf Excel) is in `otherListedOwners`, so the brand shows on both companies. Licensed or franchised marks (Domino's in India, KFC franchisees) are not attributed to the licensee. Ownership changes (sales, demergers, mergers) are checked before a brand is added.

**API.**

| Endpoint | Returns |
| :--- | :--- |
| `GET /api/v1/brands.json` | Every brand, by name |
| `GET /api/v1/brands/{slug}.json` | One brand: parent, other owners, logo URLs (SVG, mark, PNG sizes), sources |
| `GET /api/v1/companies/{market}/{ticker}.json` | Each company now lists its `brands` |

```js
const api = new StockLogosClient();
const jio = await api.brand('jio');             // jio.logo.svg, jio.logo.png['512'], jio.parent.ticker
const all = await api.brands();
const ril = await api.company('in', 'RELIANCE'); // ril.brands → [{ slug, name, kind, logo, url }, …]
```

**Add a brand.** Put the SVG in `brands/logos/<slug>.svg`, add the record to `brands/brands.json`, then run:

```bash
node scripts/logo-tool.js check brands/logos/<slug>.svg --fix   # clean, add a viewBox, namespace ids, validate
node scripts/logo-tool.js preview brands/logos/<slug>.svg out.png   # look at it on white and dark
npm run brands        # validate the registry and render the PNG sizes
npm run sync && npm run api
```

`npm test` fails on a brand whose parent is not in the catalogue, whose logo is missing or not pure vector, or a logo file without a record.

## HD full logos

`logos-hd/<market>/<TICKER>.svg` is the official full logo of a listed company (for example the TCS wordmark) when we have it. `logos/<market>/<TICKER>.svg` stays the square icon used in lists. The API returns it as `logo.hd`, and the catalogue page links it from each company's sheet.

## Hand-checked profile facts

`curated/overrides.json` holds values that were checked by hand against the company's own page or an exchange or SEC filing. Each entry carries a `sources` object with the URL behind every field:

```json
"IN:NSDL": { "ceo": "Vijay Chandok", "website": "https://nsdl.co.in", "sources": { "ceo": "https://…", "website": "https://…" } }
```

These values win over automatic data and are never overwritten by the monthly refresh. In the API, a CEO or chairman from such a source has `confidence: "high"` and the source URL. Officers change: re-check them when a company announces a change (`TODO.md` lists known upcoming ones).

## How this data was built (October 2026)

About 25 agents worked in parallel, one per group of companies or brands. Each value and logo needed a source opened at the time. Each job was then reviewed by an independent verifier that looked at every logo, checked every brand owner, every CEO and chairman, and a sample of the other fields, and removed or corrected what was wrong. Verifiers found error rates of 0 to 2 % in most jobs (up to about 8 % in logo replacement and 10 % for Korean board chairs, where "Chairman" is often an executive title); every error found was fixed before merging.
