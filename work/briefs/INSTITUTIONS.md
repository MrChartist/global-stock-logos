# Brief: Indian market institutions (regulators, government, market infrastructure, payments, industry bodies)

Read `/home/user/global-stock-logos/.work/BRIEF.md` first (quality bar, sources, tools, network rules, the October 23 updates). This brief replaces its parts A–C: you produce **institution** records.

Repository: /home/user/global-stock-logos. Your output folder: `.work/out/<JOB>/` with `institutions.json` and `NOTES.md`. Logos go to `institutions/logos/`. Only write files your job owns; check `institutions/logos/<slug>.*` does not already exist before writing.

## Logo quality (the owner will use these in presentations, so quality matters most)

1. **Vector first.** The official logo as pure vector SVG: the institution's own website (header `<svg>`, `.svg` files in the page, press/media/brand pages, annual-report or document PDFs with vector art — extract with `pdftocairo -svg` or `mutool` only if the logo is vector inside the PDF), then Wikimedia Commons / Wikipedia. Run `node scripts/logo-tool.js check <file> --fix`, then preview and look.
2. **High-resolution raster only when no vector exists anywhere.** An official PNG (or a JPEG you convert to PNG without resizing) from the institution's own site or document, at least **1,000 px** on its long side, sharp (no blur, no compression artefacts, no screenshot), transparent or clean white background. Save as `institutions/logos/<slug>.png`. Never upscale, never redraw, never trace, never AI-enhance. Check the size with `node -e "const s=require('sharp');s(process.argv[1]).metadata().then(m=>console.log(m.width,m.height))" <file>`.
3. If neither exists, do not save a logo; list it in NOTES.md with what you found.
4. Current design only (check the institution's website header today). Full logo in `<slug>.svg|png`; if the institution also uses a separate square emblem/symbol, add it as `<slug>.mark.svg|png`.
5. No aggregator sites (seeklogo, worldvectorlogo, brandsoftheworld, logowik, freelogovectors, etc.), no TradingView, no Clearbit/Brandfetch.

## Record (append to `.work/out/<JOB>/institutions.json`, a JSON array)

```jsonc
{
  "slug": "sebi",                                   // lower-case kebab-case, unique
  "name": "Securities and Exchange Board of India",
  "shortName": "SEBI",
  "kind": "regulator",   // government | ministry | regulator | central-bank | exchange | depository | clearing-corporation | payment-system |
                         // rating-agency | credit-bureau | registrar | index-provider | industry-body | professional-body | development-bank |
                         // public-programme | market-infrastructure
  "country": "IN",
  "parent": null,        // another institution's slug (e.g. "npci" for UPI, "ministry-of-finance" for CBDT) or a catalogue company "IN:NSE"
  "listedAs": null,      // "MARKET:TICKER" if the institution itself is a listed company in the catalogue (NSE → "IN:NSE", BSE → "IN:BSE", CDSL → "IN:CDSL", MCX, IEX, CRISIL…)
  "description": "Regulator of India's securities and commodity markets, set up under the SEBI Act, 1992.",
  "website": "https://www.sebi.gov.in",             // scheme + host only
  "wikidata": "Q…",                                 // only if verified
  "brandColor": "#…",                               // main colour of the logo, upper-case hex
  "logo": "institutions/logos/sebi.svg",            // or .png (≥ 1,000 px, official)
  "mark": null,                                     // or "institutions/logos/sebi.mark.svg"
  "onDark": false,                                  // true only for a light logo meant for dark backgrounds
  "logoSource": "https://…",                        // the exact page or file you took it from
  "logoSourceType": "official-site",                // official-site | press-kit | official-document | wikimedia-commons | wikipedia
  "usageNote": null,                                // e.g. State Emblem, see below
  "checkedAt": "2026-10-23"
}
```

**State Emblem of India.** Any logo that contains the State Emblem (the Lion Capital with "Satyameva Jayate") gets `"usageNote": "Contains the State Emblem of India; use is restricted by the State Emblem of India (Prohibition of Improper Use) Act, 2005."` The emblem itself, if your job includes it, uses slug `state-emblem-of-india`, kind `government`.

For an institution that is also a listed company in the catalogue, set `listedAs` and still save its own logo file under `institutions/logos/` (you may copy the verified file from `logos-hd/in/<TICKER>.svg` if it is the current official full logo; set logoSource to the original source recorded there, see `.work/out/*/logos.json`).

## Finish

`node scripts/logo-tool.js check` on every SVG; size check on every PNG; JSON parses; NOTES.md lists gaps and anything a reviewer should double-check. Final answer: counts (vector, raster, missing) and the main gaps.
