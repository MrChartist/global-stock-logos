# Data dictionary, coverage and quality

Everything below applies to `manifests/<market>.json`, `api/v1/companies/...` and the catalogue page. For what each field can realistically reach and what we tested, see [DATA-COVERAGE.md](./DATA-COVERAGE.md). Where the data comes from: [../DATA-SOURCES.md](../DATA-SOURCES.md).

## Company profile data

Besides the logo, each company in `manifests/<market>.json` carries a profile. Any value can be `null`: when a fact is not found we leave it empty (Needs verification) instead of guessing.

| Field | Source | Notes |
| :--- | :--- | :--- |
| `company`, `sector`, `industry`, `marketCap`, `exchange`, `currency`, `isin`, `employees` | TradingView scanner | Refreshed every month. `marketCap` is in `capCurrency` (the company's reporting currency); `marketCapUsd` and `marketCapInr` convert it at the daily rates in `fx-rates.json` and are approximate. Price currency (`currency`) can differ from `capCurrency` (for example UK shares are priced in pence, GBX, but market cap is in GBP) |
| `country`, `countryCode`, `flag` | TradingView scanner | Country of the company, not of the listing (an ADR in the US can show Taiwan) |
| `website`, `founded`, `headquarters`, `ceo`, `aliases`, `wikidata` | Wikidata | Matched by ISIN first; otherwise by ticker and a close name match. Community-maintained, so verify before relying on it |
| `headquarters`, `website` (gaps only) | GLEIF, SEC EDGAR | Fills only empty values. GLEIF uses the ISIN, or an exact legal-name match within the same country; SEC EDGAR covers US filers |
| `brandColor`, `brandColorSource` | Computed from the logo | An approximation taken from the logo file, not an official brand colour. `neutral-tile` means a black, white or grey logo: low confidence |
| `pngPaths` | Generated | PNG sizes 64, 128, 256 and 512 px for the 3,000 largest companies. Any other company can be rendered on demand: `node scripts/render-png.js <market> <ticker> <size>` |
| `chairman`, `address`, `addressLocal`, `headquartersLocal`, `listingDate` | Exchanges and registries (Eastmoney, TPEx, NSE, ASX, B3, GLEIF) | `Local` fields are in the local script. `listingDate` is the first listing on an exchange, not the founding date |
| `sources`, `checks` | Generated | `sources` names where each value came from. `checks` records a second source that disagreed with the value |
| `slogan` | Hand-curated only | Not available from open data. Add yours in [`curated/overrides.json`](../curated/) with a source |
| `freshness` | Generated | Dates when market data and the profile were last refreshed |

**Coverage today** (75,418 companies, refreshed 2026-10-04; it changes every month):

| Field | Filled |
| :--- | ---: |
| currency, country, flag, ISIN, brand colour | 99.5% or more |
| sector, industry | 99.2% |
| market cap | 96.6% |
| employees | 70.7% |
| website | 42.7% |
| founding year | 39.5% |
| headquarters, address or local-script address (any) | 51.0% |
| chairman | 16.9% |
| CEO | 12.7% |
| listing date | 16.9% |
| aliases | 18.2% |
| PNG sizes | 3,000 largest companies |

Coverage differs a lot by market. Hong Kong (98% website), China (90%), the UK (56% website, 88% location) and the US (53% website, 66% location) are well covered. India (4% website, 21% location), Korea (8%) and Brazil's addresses (5%) are the weakest; the reasons and the options are in [docs/DATA-COVERAGE.md](./DATA-COVERAGE.md). Every value records its source in `sources`, and a second source that disagrees is recorded in `checks`. CEO and chairman can be out of date: Needs verification. Gaps stay `null`. You can fill any of them in [`curated/overrides.json`](../curated/).

**Monthly refresh, with auto finish.** A GitHub Action ([`monthly-refresh.yml`](../.github/workflows/monthly-refresh.yml)) runs on the 1st of every month and calls one pipeline, `node scripts/run-all.js` (also `npm run all`):

1. new listings and logos, 2. logo quality repair, 3. market data, 4. Wikidata profiles, 5. GLEIF and SEC EDGAR gap-filling, 6. brand colours, 7. PNG sizes, 8. manifests, 9. validation.

The slow steps are time-boxed and resumable: a record refreshed within the last 30 days is skipped. If the job runs out of time, it commits its progress and starts itself again (up to 8 times) until `pipeline-status.json` shows `"complete": true`. Locally, run `npm run all` as many times as needed: exit code 0 means complete, 2 means run again, 1 means a check failed.

**Correctness checks.** `npm run validate` (part of `npm test` and CI) checks every ISIN (format and check digit), colour, currency, country code, flag, website, founding year, employee count, market cap, and that every manifest entry points to a real logo and PNG. Invalid values are blanked, never guessed. The result is in `data-quality-report.json`. Hand-curated values in `curated/overrides.json` are never overwritten.

## Logo quality

- Every logo is a vector SVG, so it stays sharp at any size.
- Gradient and clip ids inside each SVG are unique, so many logos can be inlined on one page without clashes.
- All SVGs pass `xmllint`. Empty and test entries are removed.
- 25 real companies have no logo available. They keep a generated initials badge, marked `"isProcedural": true` in `manifests/<market>.json`.
- 107 older PNG files remain so that existing links keep working. 37 of them are under 256 px.

Check quality with `npm run quality`, repair with `npm run quality:fix`, then run `npm run sync`.
