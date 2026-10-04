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
| TradingView scanner | Reliable, free. Returns currency, country, exchange, ISIN, employees. Website, CEO, founding year and headquarters are not supported | Used |
| Wikidata, by ISIN | Exact, no ticker clashes | Used (first choice) |
| Wikidata, by ticker plus name | Works, but tickers clash across countries | Used only with a name check |
| Wikidata, by name | Gives a few more matches. Must be verified as a business in the right country | Used (`enrich-by-name.js`), strict |
| GLEIF, by ISIN | Good for US, EU, UK, Japan. Nothing for India, Korea, Qatar and some others. Does not say which ISIN matched, so names are checked | Used |
| GLEIF, by name and country | India about 70% on the largest unmatched companies. Korea 0%, China 0%, Taiwan about 4% | Used, and skipped automatically where the hit rate is under 2% |
| SEC EDGAR | Free, reliable US headquarters. Website is often empty. Needs a plain "Name email" user agent | Used |
| NSE and BSE (India) APIs | Blocked from our test machine (503 and 403). Need browser cookies | Not used. A GitHub runner might behave differently: Needs verification |
| Yahoo Finance | Needs a crumb and cookie; returned 401 and 429 | Not used |
| Commercial APIs (Financial Modeling Prep, Finnhub and similar) | Would give website, CEO, employees and founding year for most listed companies, but need an API key. Their terms usually forbid republishing the data in a public dataset: Needs verification | Not used. Check the licence before adding |

## How to close the remaining gaps

1. **Contribute facts.** Add website, CEO, founding year and slogans in `curated/overrides.json` with a source link. These always win.
2. **Official exchange or registry data.** Korea (KRX/DART), Taiwan (TWSE/MOPS), China (SSE/SZSE), India (NSE/BSE) publish company profiles. Each needs its own script and a check that it works from a GitHub runner.
3. **A licensed data source** whose terms allow redistribution, if one exists for your use.

The monthly pipeline keeps trying: `enrich-by-name.js` works from the largest companies downwards and resumes on each run.
