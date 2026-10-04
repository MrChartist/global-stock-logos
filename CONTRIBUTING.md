# Contributing to Global Stock Logos

Thank you for helping. This project is maintained by [@MrChartist](https://mrchartist.com) and is open to everyone.

## Ways to help

- Add an official logo for a company listed in [`quality-report.json`](./quality-report.json).
- Report a wrong, missing or outdated logo (use the issue templates).
- Add a country or exchange in `scripts/markets.js`.
- Write a data adapter for a market with weak coverage: see [docs/ADAPTERS.md](./docs/ADAPTERS.md).
- Improve scripts, documentation or the React component in `src/`.

## Adding or replacing a logo

1. Fork the repository and create a branch.
2. Save the logo as `logos/<market>/<TICKER>.svg`. The market folder name is in `scripts/markets.js`.
3. Use an official or openly licensed vector. Do not redraw or trace a brand logo.
4. Keep it a single valid SVG: no scripts, no external links, no embedded fonts.
5. Run `npm run quality`, then `npm run sync && npm run api`, then `npm test`.
6. In the pull request, state the ticker, market and where the logo came from. Add the source to `logo-sources.json` if it is not from TradingView.

## Code changes

- Node.js 18 or newer. The project has no runtime dependencies; please do not add any without discussion.
- Match the existing style (4-space indent, ES modules).
- Run `npm ci` once, then `npm test` before opening a pull request. It checks the logos, the data, every file of the API against its JSON Schema, the types and the client. CI runs the same.
- The catalogue page has a browser test: `npm run test:frontend` (needs Chromium; set `CHROME_PATH` if it is not found).

## Large generated changes

Logo files, manifests and the API are produced by scripts. Please do not edit `manifests/`, `api/`, `search-index.json` or `logos-manifest.json` by hand; run `npm run sync && npm run api`.

## Conduct and security

By taking part you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md). Report security issues as described in [SECURITY.md](./SECURITY.md), not in public issues.
