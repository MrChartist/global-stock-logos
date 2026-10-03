# Global Stock Logos

<div align="center">

**Free, open-source company logos for 75,000+ listed stocks across 68 markets.**

A project by **[@MrChartist](https://mrchartist.com)** · [mrchartist.com](https://mrchartist.com)

![Logos](https://img.shields.io/badge/logos-75%2C000%2B-blue.svg?style=for-the-badge)
![Markets](https://img.shields.io/badge/markets-68-blueviolet.svg?style=for-the-badge)
![Format](https://img.shields.io/badge/format-SVG-orange.svg?style=for-the-badge)
![License](https://img.shields.io/badge/code-MIT-green.svg?style=for-the-badge)

[Browse catalogue](./index.html) • [Use via CDN](#use-via-cdn) • [Quality](#logo-quality) • [Contribute](#contributing) • [Licence and trademarks](#licence-and-trademarks)

</div>

---

## About

Global Stock Logos is an open-source logo library for traders, analysts, educators and fintech developers. Every logo is a vector SVG named by stock ticker and served free through the jsDelivr CDN, so you can show a company logo next to a quote, chart or watchlist with one `<img>` tag.

Coverage is strongest for India (NSE/BSE) and the US (NASDAQ/NYSE), and includes the UK, Germany, Japan, China, Korea, Canada, Australia, Brazil and many more. Companies that have no published logo are not included; the list is in [`quality-report.json`](./quality-report.json).

## Use via CDN

Every logo lives at `logos/<market>/<TICKER>.svg`. Market folder names are lowercase (`us`, `in`, `uk`, `japan`, `china`, `korea`, `brazil`, ...). The full list is in [`logos-manifest.json`](./logos-manifest.json).

```html
<!-- Apple (US) -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/us/AAPL.svg" width="32" height="32" alt="Apple" />

<!-- Reliance Industries (India, NSE) -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/RELIANCE.svg" width="32" height="32" alt="Reliance" />

<!-- Samsung Electronics (South Korea) -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/korea/005930.svg" width="32" height="32" alt="Samsung" />
```

Always use the market folder. Flat URLs such as `logos/AAPL.svg` exist only for about 2,800 older symbols and may be removed.

### Catalogue data

| File | Contents |
| :--- | :--- |
| [`logos-manifest.json`](./logos-manifest.json) | Totals, per-market counts and the location of each market file |
| [`manifests/<market>.json`](./manifests/) | Company name, sector, industry, Yahoo Finance link and file path for each ticker |
| [`search-index.json`](./search-index.json) | Compact list of every logo, for search boxes |
| [`logo-sources.json`](./logo-sources.json) | Source and match record for logos not taken from TradingView |
| [`png/<size>/<market>/`](./png/) | PNG versions (64, 128, 256, 512 px) for the 3,000 largest companies |
| [`enrichment/<market>.json`](./enrichment/) | Raw profile data with retrieval dates |

Each Yahoo Finance link is built from the ticker and the market suffix in `scripts/markets.js`. Suffixes for some smaller markets are blank there: Needs verification.

## Company profile data

Besides the logo, each company in `manifests/<market>.json` carries a profile. Any value can be `null`: when a fact is not found we leave it empty (Needs verification) instead of guessing.

| Field | Source | Notes |
| :--- | :--- | :--- |
| `company`, `sector`, `industry`, `marketCap`, `exchange`, `currency`, `isin`, `employees` | TradingView scanner | Refreshed every month |
| `country`, `countryCode`, `flag` | TradingView scanner | Country of the company, not of the listing (an ADR in the US can show Taiwan) |
| `website`, `founded`, `headquarters`, `ceo`, `aliases`, `wikidata` | Wikidata | Matched by ISIN first; otherwise by ticker and a close name match. Community-maintained, so verify before relying on it |
| `headquarters`, `website` (gaps only) | GLEIF, SEC EDGAR | Fills only empty values. GLEIF uses the ISIN; SEC EDGAR covers US filers |
| `brandColor`, `brandColorSource` | Computed from the logo | An approximation taken from the logo file, not an official brand colour. `neutral-tile` means a black, white or grey logo: low confidence |
| `pngPaths` | Generated | PNG sizes 64, 128, 256 and 512 px for the 3,000 largest companies. Any other company can be rendered on demand: `node scripts/render-png.js <market> <ticker> <size>` |
| `slogan` | Hand-curated only | Not available from open data. Add yours in [`curated/overrides.json`](./curated/) with a source |
| `freshness` | Generated | Dates when market data and the profile were last refreshed |

**Coverage today** (75,417 companies, refreshed 2026-10-03; it changes every month):

| Field | Filled |
| :--- | ---: |
| currency, country, flag, ISIN, brand colour | 99.5% or more |
| sector, industry | 99.2% |
| market cap | 96.6% |
| employees | 71.3% |
| headquarters | 38.4% |
| website | 25.5% |
| founding year | 24.1% |
| aliases | 18.0% |
| CEO | 5.2% |
| PNG sizes | 3,000 largest companies |

Website, founding year and CEO depend on Wikidata, which covers large and well-known companies far better than small ones. Headquarters also comes from GLEIF and SEC EDGAR, which fill mostly US and European companies. India, Korea, China and Taiwan have the weakest coverage, because their ISINs are not in GLEIF. Gaps stay `null`. You can fill any of them in [`curated/overrides.json`](./curated/).

**Monthly refresh.** A GitHub Action ([`monthly-refresh.yml`](./.github/workflows/monthly-refresh.yml)) runs on the 1st of every month: new listings, market data, profiles older than 30 days, brand colours, PNG sizes, manifests. Run it yourself with `npm run monthly`. Hand-curated values in `curated/overrides.json` are never overwritten.

## Logo quality

- Every logo is a vector SVG, so it stays sharp at any size.
- Gradient and clip ids inside each SVG are unique, so many logos can be inlined on one page without clashes.
- All SVGs pass `xmllint`. Empty and test entries are removed.
- 25 real companies have no logo available. They keep a generated initials badge, marked `"isProcedural": true` in `manifests/<market>.json`.
- 107 older PNG files remain so that existing links keep working. 37 of them are under 256 px.

Check quality with `npm run quality`, repair with `npm run quality:fix`, then run `npm run sync`.

## 🚀 React / Next.js Integration

Our universal `<StockLogo />` component gracefully handles both Indian and US equities, with an automatic 5-tier fallback waterfall with a fallback to a generated badge when no image loads:

```tsx
import React, { useState } from 'react';

export type StockMarket = 'IN' | 'US' | 'AUTO';

interface StockLogoProps {
  symbol: string;
  market?: StockMarket; // 'IN' | 'US' | 'AUTO' (default: 'AUTO')
  companyName?: string;
  size?: number;
  className?: string;
  cdnRepo?: string; // e.g. "MrChartist/global-stock-logos"
}

export const StockLogo: React.FC<StockLogoProps> = ({
  symbol,
  market = 'AUTO',
  companyName = '',
  size = 32,
  className = '',
  cdnRepo = 'MrChartist/global-stock-logos'
}) => {
  const [sourceIdx, setSourceIdx] = useState(0);
  const sym = (symbol || 'NA').toUpperCase().trim().replace(/[^A-Za-z0-9_.-]/g, '');
  const mkt = market === 'AUTO' ? '' : market.toLowerCase();
  const baseUrl = `https://cdn.jsdelivr.net/gh/${cdnRepo}@main/logos`;

  const sources: string[] = [];
  if (mkt) {
    sources.push(`${baseUrl}/${mkt}/${sym}.svg`);
    sources.push(`${baseUrl}/${mkt}/${sym}.png`);
  }
  sources.push(`${baseUrl}/${sym}.svg`);
  sources.push(`${baseUrl}/${sym}.png`);
  if (mkt === 'in' || !mkt) {
    sources.push(`${baseUrl}/in/${sym}.svg`);
    sources.push(`${baseUrl}/in/${sym}.png`);
  }
  if (mkt === 'us' || !mkt) {
    sources.push(`${baseUrl}/us/${sym}.svg`);
    sources.push(`${baseUrl}/us/${sym}.png`);
  }

  // Final fallback: procedural SVG monogram badge
  if (sourceIdx >= sources.length) {
    const charCode = sym.charCodeAt(0) || 65;
    const hue = (charCode * 37) % 360;
    return (
      <div
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${(hue + 45) % 360}, 75%, 25%))`
        }}
        className={`inline-flex shrink-0 items-center justify-center rounded-full text-white font-bold text-xs uppercase shadow-xs ${className}`}
        title={`${sym} - ${companyName || 'Stock'}`}
      >
        {sym.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={sources[sourceIdx]}
      alt={`${sym} logo`}
      width={size}
      height={size}
      onError={() => setSourceIdx((prev) => prev + 1)}
      className={`rounded-full object-contain bg-white/5 border border-slate-700/30 shrink-0 ${className}`}
      loading="lazy"
    />
  );
};
```

---

## 📱 Multi-Platform Examples

### Vanilla HTML / JavaScript
```html
<!-- US Stock -->
<img 
  src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/us/NVDA.svg"
  onerror="this.onerror=null; this.src='https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/us/NVDA.png';"
  width="32" height="32" alt="NVDA" 
/>

<!-- Indian Stock -->
<img 
  src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/INFY.svg"
  onerror="this.onerror=null; this.src='https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/INFY.png';"
  width="32" height="32" alt="INFY" 
/>
```

### Flutter (Dart)
```dart
Widget buildStockLogo(String symbol, {String market = 'us'}) {
  final sym = symbol.toUpperCase();
  return SvgPicture.network(
    // Needs the flutter_svg package: SvgPicture.network works for .svg files
    'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/$market/$sym.svg',
    width: 36,
    height: 36,
    placeholderBuilder: (context) => CircleAvatar(
      child: Text(sym.substring(0, sym.length >= 2 ? 2 : 1)),
    ),
  );
}
```

### Python (Streamlit / Dash / Matplotlib)
```python
def get_stock_logo_url(symbol: str, market: str = "us", repo: str = "MrChartist/global-stock-logos") -> str:
    sym = symbol.upper().strip()
    return f"https://cdn.jsdelivr.net/gh/{repo}@main/logos/{market.lower()}/{sym}.svg"
```

---

---

## Repository layout

```
logos/<market>/<TICKER>.svg    Logo files, one folder per market
manifests/<market>.json        Company details per market
logos-manifest.json            Summary and index of market files
search-index.json              Compact search index
logo-sources.json              Sources for Wikidata/Commons logos
quality-report.json            Placeholders, small PNGs, invalid files
companies-metadata.json        Raw company metadata used to build manifests
index.html                     Browsable catalogue
scripts/
  markets.js                   Market list (single source of truth)
  bulk-crawl.js                Download logos for every market
  wikidata-logos.js            Fill gaps from Wikidata / Wikimedia Commons
  quality.js, svg-quality.js   Audit and repair rules
  sync.js                      Rebuild manifests and search index
  audit.js                     Legacy integrity check
src/                           React component and helpers
.github/workflows/daily-sync.yml
```

## Commands

```bash
npm run bulk                 # download logos for all markets (resumable)
node scripts/bulk-crawl.js --markets korea,china
node scripts/wikidata-logos.js   # fill missing logos from Wikidata / Commons
npm run refresh              # market data (market cap, sector, currency, ISIN)
npm run enrich               # company profiles from Wikidata
npm run registries           # fill gaps from GLEIF and SEC EDGAR
npm run colors && npm run png  # brand colours and PNG sizes
npm run monthly              # everything above, in order
npm run quality              # audit; use quality:fix to repair
npm test                     # offline check used by CI (invalid XML, active content, unique ids)
npm run sync                 # rebuild manifests and search index
```

Node.js 18 or newer is required. The scripts need internet access.

## Contributing

Contributions are welcome, especially official logos for companies listed in `quality-report.json`. Read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md) first.

1. Fork the repository and create a branch.
2. Add a clean SVG as `logos/<market>/<TICKER>.svg`. Please use only official or openly licensed artwork.
3. Run `npm run quality` and `npm run sync`.
4. Open a pull request and mention the source of the logo.

To report a wrong or missing logo, open an issue with the ticker and market.

## Licence and trademarks

- Code, scripts and workflows are released under the [MIT License](./LICENSE).
- All logos, brand names and emblems belong to their respective owners. They are included for editorial and informational use, such as stock identification in charts, research and learning material. Inclusion does not mean endorsement by, or affiliation with, any company.
- Logos from Wikimedia Commons keep their own licences; see `logo-sources.json`. If you are a rights holder and want a logo removed, write to [contact@mrchartist.com](mailto:contact@mrchartist.com).
- Logo data comes from TradingView's public symbol-logo service and Wikidata. Please check their terms before heavy commercial use. Full details are in [DATA-SOURCES.md](./DATA-SOURCES.md).
- Security issues: see [SECURITY.md](./SECURITY.md).

## Disclaimer

This project is for education and information only. It is not investment advice. Market data, tickers and Yahoo Finance links should be verified before use.

---

Built by **[@MrChartist](https://mrchartist.com)** · [mrchartist.com](https://mrchartist.com)
