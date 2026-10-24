# Brief: replace placeholder and PNG-only company logos

Read `/home/user/global-stock-logos/.work/BRIEF.md` (quality bar, sources, tools, network rules, part B, Raster fallback) and the "Lessons from round 3" in `.work/ROUND4.md`. Never run git commands that change state. Only write files your job owns.

Your list is `.work/jobs/<JOB>.tsv`: `MARKET:TICKER  name  kind  marketCapUsd  website  country`, largest first. `kind` is `placeholder` (a generated initials badge in `logos/<mk>/<T>.svg`) or `png-only` (only `logos/<mk>/<T>.png`, often small, sometimes another company's logo).

For each company, in order of size:

1. **Same company, other listing.** Many rows are ADRs, preferred shares, units or depositary shares of a company that already has a correct logo under another ticker or market (e.g. `US:TELWY` = Tokyo Electron, `JAPAN:8035`; `US:PSAPT` = Public Storage preferred, `US:PSA`). Find it with `node scripts/logo-tool.js find "<words>"`, preview that logo and, if it is the correct current logo of the same company (not a placeholder itself), copy it to `logos/<mk>/<T>.svg`. Record `reason: "same company as <KEY>"`, `source`: the source of that logo if known, else `https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/<mk2>/<T2>.svg`, `sourceType: "catalogue"`. Check the identity (name, ISIN prefix, ADR sponsor) — never copy across different companies with similar names.
2. **Otherwise find the official logo**: the company's own site (header SVG, favicon/apple-touch SVG, press kit), annual report PDF (vector paths copied unchanged, see ROUND4.md), Wikimedia Commons (file page sourced from the company; on 429 use `.work/wm-queue/<JOB>.tsv`). The main logo is a square-friendly symbol or icon when the company has one, else the full logo (the catalogue renders it contained). Vector only for the main logo; no rasters, no redraws, no aggregators, no TradingView/Clearbit.
3. Write `logos/<mk>/<T>.svg` (run `node scripts/logo-tool.js check <file> --fix`; preview and look). For a png-only company, leave the `.png` in place; record it and the merge removes the old PNG.
4. If you can't find a correct official vector, leave the company alone and list it in NOTES.md with the reason. A placeholder is better than a wrong logo.

Record every replacement in `.work/out/<JOB>/logos.json` (array): `{ "key": "US:OKE", "file": "logos/us/OKE.svg", "kind": "main", "source": "<url>", "sourceType": "official-site|official-document|wikimedia-commons|catalogue", "reason": "placeholder|png-only|same company as <KEY>" }`. A full official wordmark you find along the way may also go to `logos-hd/<mk>/<T>.svg` (record `kind: "hd"`).

Finish: every SVG passes check; JSON parses; NOTES.md; final answer: counts (replaced by copying, replaced from official sources, left as placeholder) and the main gaps.
