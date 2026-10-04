# Data coverage: what is possible and what is not

This page records what we tested, so nobody repeats the same experiments. Dates are 2026-10; sources change, so re-test before relying on it.

## What fills each field today

| Field | Sources used (in order) | Realistic ceiling with open data |
| :--- | :--- | :--- |
| currency, country, ISIN, sector, industry, market cap, exchange | TradingView scanner | About 100% |
| flag, brand colour | Computed | About 100% |
| employees | TradingView, then Wikidata | About 70%. Fractional values from TradingView are rejected |
| headquarters | Wikidata, GLEIF by ISIN, SEC EDGAR (US), GLEIF by name and country | High for US, UK, EU and India large caps. Low for Korea, China, Taiwan |
| website | Wikidata, SEC EDGAR | Large and well-known companies only |
| founding year | Wikidata | Same as website |
| CEO | Wikidata (current office-holders only) | Low. Wikidata rarely keeps CEOs up to date |
| aliases | Wikidata | Low |
| slogan | Hand-curated only (`curated/overrides.json`) | Depends on contributors |

## What we tested

| Source | Result | Decision |
| :--- | :--- | :--- |
| TradingView scanner | Reliable, free. Currency, country, exchange, ISIN, employees. No website, CEO, founding year or headquarters | Used |
| Wikidata (ISIN, then ticker plus name, then name plus country) | Exact by ISIN. Good for large companies. CEO can be out of date (for example HSBC still shows a CEO who has left) | Used; CEO flagged as source-dependent |
| GLEIF by ISIN, and by name plus country | Good for US, EU, UK, India (by name). Nothing for Korea, China, Qatar by ISIN. Does not say which ISIN matched | Used; skipped per country when hit rate is under 2% |
| GLEIF by single ISIN | Exact. Fixes Japan, where legal names are in Japanese and name checks fail | Used for Japan |
| SEC EDGAR | Free, reliable US headquarters. Needs a plain "Name email" user agent | Used |
| Eastmoney company profile API (US, Hong Kong, China) | Website, address, chairman, president, employees, founding date, listing date. US and HK rows carry an ISIN, so every match is verified. Unofficial public endpoint | Used. Check its terms before heavy use |
| TPEx open data (Taiwan OTC) | Official. Chairman, general manager, English address, incorporation and listing dates, website | Used |
| TWSE open data (Taiwan main board) | Blocked ("security reasons") from our machine | Not used: Needs verification from a GitHub runner |
| NSE archive (India) | Listing dates and ISINs. Used to confirm TradingView ISINs: 2,526 of 2,527 agree | Used |
| NSE and BSE company APIs (India) | 403 / 503 from our machine, need browser cookies | Not used |
| ASX directory (Australia) | Listing dates and industry | Used |
| B3 listed companies (Brazil) | Official. Website, first quotation date, an ISIN per ticker | Used; ticker and ISIN verified |
| TMX Money (Canada) | Website and employees. Many top entries are CDRs of US companies and are correctly rejected by the name check | Used |
| KRX KIND, DART (Korea) | KIND blocked. DART gives website, CEO, address and founding date but needs a free API key | Not used: add a key to enable (see below) |
| SZSE, SSE, SET (Thailand), BSE, FnGuide | Blocked or empty from our machine | Not used |
| Yahoo Finance | Needs crumb and cookie; 401 and 429 | Not used |
| Commercial APIs (Financial Modeling Prep, Finnhub and similar) | Would cover most remaining gaps but need keys, and their terms usually forbid republishing the data in a public dataset: Needs verification | Not used |

## How data is verified

- **Identity first.** A record from any source is accepted only if its ISIN equals ours (US, Hong Kong, Brazil, Japan, India), or its exchange code and a close name agree (China, Taiwan, Canada), or Wikidata's ISIN, or ticker plus name, matches. Failures are counted, never written.
- **Fill, never overwrite.** Every source fills only empty fields and records itself in `sources`.
- **Cross-checks.** When a second source disagrees with a value we already hold (a different website domain, or founding years more than one year apart), the disagreement is stored in `checks` and shown in the manifest. Many are harmless (investor-relations subdomains, incorporation versus founding year) but they are visible.
- **Format checks.** `npm run validate` checks ISIN check digits, URLs, dates, colours, currencies and country codes.
- **CEO and chairman** come from the source named in `sources` and can be out of date. Treat them as Needs verification.

## Enabling Korea (needs your key)

DART (opendart.fss.or.kr) gives Korean website, CEO, address and founding date for free with a registered API key. If you add a key as the GitHub secret `DART_API_KEY`, a Korea adapter can be added the same way as the others. We have not written it, because it cannot be tested without a key.

## How to close the remaining gaps

1. Add facts to `curated/overrides.json` with a source link. These always win.
2. Official exchange or registry data for the remaining markets (Korea, Thailand, India, Germany, UK), each needing its own adapter and a test from a GitHub runner.
3. A licensed data source whose terms allow redistribution, if one exists for your use.
