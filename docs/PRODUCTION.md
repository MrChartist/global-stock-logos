# Using this on a production website

What to do, and what to know, before logos and profiles from this repository appear on a site people rely on.

## 1. Pin a version

`@main` changes daily and the CDN may cache it for hours. Use a commit hash now, and a release tag once one is published (see [ROADMAP.md](./ROADMAP.md), phase 0):

```
https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@<commit-or-tag>/logos/in/TCS.svg
```

Take the commit from the repository's history, test your pages against it, and move it forward on your own schedule. Keep the version in one constant so a change is one line.

## 2. Decide which logos you show

Every company has a logo file, but they do not all have the same standing. The API says which is which in `logo.provenance`:

| `provenance` | Meaning | Count today |
| :--- | :--- | ---: |
| `official` | Checked against the owner's site, press kit or an official document; `provenanceSource` is the page | 0 |
| `commons` | Wikimedia Commons; the file keeps its own licence (`provenanceSource`) | 3 |
| `crawled` | TradingView's symbol-logo service, not checked file by file. Not yet verified, not known to be wrong | 80,256 |
| `generated` | An initials badge drawn by us, not a real logo | 180 |

Counts are in `api/v1/index.json` under `logoProvenance`; `npm run tiers` shows them with the field coverage by size tier. The `official` count starts at zero because no per-file check had been recorded; it grows as entries are added to [`curated/logo-provenance.json`](../curated/logo-provenance.json).

Practical rules:

- If you need logos with a known source (a paid product, an app store listing, a legal review), show only `official` and `commons`, and use your own fallback for the rest.
- If you can accept the rights position described in [DATA-SOURCES.md](../DATA-SOURCES.md), show `crawled` logos too, keep the takedown contact on your site, and never show `generated` badges as if they were logos (`isPlaceholder: true`).
- Logos and brand names belong to their owners. They identify a company; do not use them to suggest endorsement.

## 3. Always have a fallback

```html
<img src="…/logos/in/TCS.svg" width="32" height="32" alt="TCS logo" loading="lazy"
     onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'logo-fallback',textContent:'TCS'}))">
```

A logo can be missing for a new listing, renamed after a ticker change, or temporarily unavailable from the CDN. Render initials, never a broken image. Set `width` and `height` so the page does not shift.

## 4. Dark backgrounds

Some logos are dark marks that disappear on a dark page, and the data has no dark variant yet. Until it does, put logos on a light tile (white or `#F9F8F5`, 8 px padding, rounded corners) in dark mode. The catalogue page does this; see [DESIGN.md](./DESIGN.md).

## 5. Treat facts by their confidence

- `profile.ceo` and `profile.chairman` carry `confidence`. `high` was checked by hand against the company's page or a filing (the source is the URL). `low` is community data that may be years old. On a public page, show `low` values with a label, or leave them out.
- `null` means unknown. Do not replace it with a guess.
- `marketCap.asOf` is the date of the figure; show it. `marketCap.usd` and `inr` are converted at the daily rate in `fx-rates.json` and are approximate.
- Profile data is information only, not investment advice.

## 6. Be kind to the CDN

Cache responses on your side. Fetch `search-index.json` (about 5 MB) once and search in memory, or render the first screen from `search-index-top.json` (about 160 KB). Per-company files are about 1 KB. If your traffic is large, or you need a guarantee, self-host the `api/`, `logos/`, `png/` and `search-index.json` paths from any static host and pass `baseUrl` to the client ([API.md](./API.md#good-practice)).

## 7. Corrections and removals

A wrong value, a wrong logo or a rights holder's request: write to [contact@mrchartist.com](mailto:contact@mrchartist.com). Logo removals are handled as described in [DATA-SOURCES.md](../DATA-SOURCES.md).

## Checklist

- [ ] Version pinned to a commit or tag
- [ ] Logo policy chosen (`official` and `commons` only, or all with a fallback)
- [ ] Fallback for missing images, with image size set
- [ ] Dark-mode tile for logos
- [ ] Low-confidence officers labelled or hidden
- [ ] Market cap shown with its date
- [ ] Responses cached; takedown contact on the site
