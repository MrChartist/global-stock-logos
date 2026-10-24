# Verifier brief

You are an independent reviewer. Other agents produced logos and facts under the rules in `/home/user/global-stock-logos/.work/BRIEF.md` (read it first). Your prompt names the jobs you review; their outputs are in `.work/out/<JOB>/` (`brands.json`, `logos.json`, `profiles.json`, `NOTES.md`) and the files they reference (`brands/logos/*.svg`, `logos-hd/**`, `logos/<market>/<TICKER>.svg`).

Assume nothing is right until you have checked it. Your job is to **remove or fix what is wrong**, not to add new work.

## Check

1. **Every logo** they wrote (brand logos, HD logos, replaced main logos): run `node scripts/logo-tool.js check <file>` and `node scripts/logo-tool.js preview <file> .work/tmp/verify-<you>/<name>.png 384`, then **look at the PNG with the Read tool** (you may montage several previews into one image with sharp to save time, but every logo must be seen). Reject a logo that: is the wrong brand; is an outdated design when a newer one is in use (e.g. a pre-rebrand mark); is cropped, blank, garbled, or only a white shape on transparent without `onDark: true`; is a fan redraw or from a forbidden source (TradingView, Clearbit, Brandfetch, aggregator sites); contains raster. Check that `logoSource` is a URL on an allowed source and plausibly the file.
2. **Brand ownership**: for every brand, is `parent` really the current (2026) ultimate listed owner, and is the ticker the right listing (home listing, not a GDR/ADR when the home listing is in the catalogue; check with `node scripts/logo-tool.js find`)? Check the ones you are not certain about against a source (company website, annual report, Wikipedia). Watch for divestments, demergers and licences (a licensee or franchisee is not the owner).
3. **Profile facts**: for every company, verify **every CEO and chairman** value against the company's own leadership/board page or a 2025–2026 filing (open the `_sources` URL, and if it does not clearly support the value, search the company site). Verify a random 30% of the other fields (website, founded, headquarters, slogan) by opening their sources. A wrong value is worse than a missing one.

## Fix

- Edit the job's JSON files in place: delete wrong records/fields or correct them (with a working source URL in `_sources`). Delete rejected logo files (`brands/logos/<slug>.svg`, `logos-hd/...`). For a wrongly replaced **main** logo `logos/<market>/<TICKER>.svg`, restore the original with `git checkout -- logos/<market>/<TICKER>.svg` (the only git command you may run) and remove its entry from `logos.json`.
- Keep files valid JSON.

## Report

Write `.work/out/<JOB>/VERIFY.md` for each job: counts checked / fixed / removed, and a list of every change with the reason. Your final answer: one paragraph per job with those counts and the error rate you found.

## Institution jobs (inst-*)

Records are in `.work/out/<JOB>/institutions.json`, logos in `institutions/logos/` (SVG, or official PNG ≥ 1,000 px). Check every logo the same way (right institution, current design, complete, official source, vector or legitimately raster-only), the `kind`, `parent`/`listedAs`, `website`, and that every logo containing the State Emblem has the usageNote. Records with `logo: null` are dropped at merge; ignore them. Write VERIFY.md in the job folder.

## Raster files (any job)

For a PNG logo: confirm no vector exists at the listed sources, it comes from the official site/document, it is ≥ 1,000 px as published (not upscaled: look for blur/halo at 100 % zoom), sharp, complete, current.
