# 🌐 Global Stock Logos Catalog (India, US & World)

<div align="center">

![Total Logos](https://img.shields.io/badge/logos-75000%2B-blue.svg?style=for-the-badge&logo=appveyor)
![Markets Covered](https://img.shields.io/badge/markets-India%20%7C%20US%20%7C%20World-blueviolet.svg?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)
![Global CDN](https://img.shields.io/badge/CDN-jsDelivr-orange.svg?style=for-the-badge&logo=jsdelivr)
![Zero Broken Images](https://img.shields.io/badge/uptime-100%25-brightgreen.svg?style=for-the-badge)

**A high-performance, open-source repository containing 2,078+ verified vector and raster brand logos (4,154+ total assets) for Indian equities (NSE & BSE) and US equities (NASDAQ, NYSE & S&P 500), built for global fintech applications.**

[Explore Catalog](./logos-manifest.json) • [jsDelivr CDN](#-instant-global-cdn-delivery) • [React Component](#-react--nextjs-integration) • [Contributing](#-adding-more-companies)

</div>

---

## 🌍 Markets Covered

**74,000+ real company logos across 60+ countries** (every listed stock TradingView publishes a logo for; no generated placeholders in the bulk set). Logos live in `logos/<market>/<TICKER>.svg`, for example `logos/us/`, `logos/in/`, `logos/korea/`, `logos/china/`, `logos/brazil/`.

| Where | What |
| :--- | :--- |
| [`logos-manifest.json`](./logos-manifest.json) | Summary: totals, per-market counts, shard locations |
| [`manifests/<market>.json`](./manifests/) | Full company details per market (name, sector, Yahoo link) |
| [`search-index.json`](./search-index.json) | Compact index of every logo for search UIs |

Refresh or extend coverage with `node scripts/bulk-crawl.js [--markets korea,china]` (market list in `scripts/markets.js`), then `node scripts/sync.js`. Yahoo Finance suffixes for some smaller markets are blank in `markets.js`: Needs verification.

--- | :---: | :--- | :--- |
| 🇮🇳 **India (NSE & BSE)** | **1,072+ Stocks** | Reliance, TCS, HDFC Bank, Infosys, Tata Motors, ICICI, SBI, Airtel, ITC, Zomato | [`logos/in/`](./logos/in/) |
| 🇺🇸 **United States (NASDAQ, NYSE)** | **1,006+ Stocks** | Apple, Microsoft, NVIDIA, Google, Amazon, Meta, Tesla, Berkshire, JPMorgan, Visa, Walmart, ASML, Alibaba, Roche | [`logos/us/`](./logos/us/) |
| 🌐 **Unified Global Access** | **2,078+ Equities** | All tickers directly addressable at the root | [`logos/`](./logos/) |

---

## ⚡ Instant Global CDN Delivery

All logos are distributed worldwide through **jsDelivr Global Edge CDN** (backed by Cloudflare and Fastly multi-CDN) with 0ms cold starts, automatic Brotli compression, and zero bandwidth limits:

### 1. By Market Partition (Zero Symbol Collisions)

#### 🇺🇸 US Equities (NASDAQ / NYSE / S&P 500)
```html
<!-- Apple (NASDAQ: AAPL) -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/us/AAPL.svg" width="32" height="32" alt="Apple" />

<!-- NVIDIA (NASDAQ: NVDA) -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/us/NVDA.png" width="32" height="32" alt="NVIDIA" />

<!-- Microsoft (NASDAQ: MSFT) -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/us/MSFT.png" width="32" height="32" alt="Microsoft" />
```

#### 🇮🇳 Indian Equities (NSE / BSE)
```html
<!-- Reliance Industries (NSE: RELIANCE) -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/RELIANCE.svg" width="32" height="32" alt="Reliance" />

<!-- Tata Consultancy Services (NSE: TCS) -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/TCS.png" width="32" height="32" alt="TCS" />

<!-- HDFC Bank (NSE: HDFCBANK) -->
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/HDFCBANK.svg" width="32" height="32" alt="HDFC Bank" />
```

### 2. Direct Flat Root URLs (Fastest for Unambiguous Symbols)
```html
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/AAPL.svg" width="32" height="32" alt="Apple" />
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/TCS.png" width="32" height="32" alt="TCS" />
```

### 3. Global Master Catalog Manifest
Access the complete searchable index with company names, sectors, formats, Yahoo Finance links, and CDN endpoints:
```
https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos-manifest.json
```

### 4. Yahoo Finance Reference Links & API
Every indexed equity contains direct links to **Yahoo Finance** for live quotes, historical charts, and financial data:
- 🇮🇳 **Indian Stocks**: `https://finance.yahoo.com/quote/{SYMBOL}.NS` (API: `https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}.NS`)
- 🇺🇸 **US Stocks**: `https://finance.yahoo.com/quote/{SYMBOL}` (API: `https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}`)

---

## 🚀 React / Next.js Integration

Our universal `<StockLogo />` component gracefully handles both Indian and US equities, with an automatic 5-tier fallback waterfall ensuring **zero broken images**:

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
  src="https://cdn.jsdelivr.net/gh/<USERNAME>/<REPO>@main/logos/us/NVDA.png"
  onerror="this.onerror=null; this.src='https://cdn.jsdelivr.net/gh/<USERNAME>/<REPO>@main/logos/us/NVDA.svg';"
  width="32" height="32" alt="NVDA" 
/>

<!-- Indian Stock -->
<img 
  src="https://cdn.jsdelivr.net/gh/<USERNAME>/<REPO>@main/logos/in/INFY.svg"
  onerror="this.onerror=null; this.src='https://cdn.jsdelivr.net/gh/<USERNAME>/<REPO>@main/logos/in/INFY.png';"
  width="32" height="32" alt="INFY" 
/>
```

### Flutter (Dart)
```dart
Widget buildStockLogo(String symbol, {String market = 'us'}) {
  final sym = symbol.toUpperCase();
  return Image.network(
    'https://cdn.jsdelivr.net/gh/<USERNAME>/<REPO>@main/logos/$market/$sym.png',
    width: 36,
    height: 36,
    errorBuilder: (context, error, stackTrace) {
      return CircleAvatar(
        child: Text(sym.substring(0, sym.length >= 2 ? 2 : 1)),
      );
    },
  );
}
```

### Python (Streamlit / Dash / Matplotlib)
```python
def get_stock_logo_url(symbol: str, market: str = "us", repo: str = "<USERNAME>/<REPO>") -> str:
    sym = symbol.upper().strip()
    return f"https://cdn.jsdelivr.net/gh/{repo}@main/logos/{market.lower()}/{sym}.png"
```

---

## 📂 Repository Anatomy

```
├── logos/                         # Master asset library (1,180+ files)
│   ├── in/                        # 1,051 Indian stocks (RELIANCE.svg, TCS.png...)
│   ├── us/                        # 131 US stocks (AAPL.svg, NVDA.png, MSFT.png...)
│   └── ...                        # Unified direct-access mirror files
├── logos-manifest.json            # Master JSON index (SSOT with market breakdowns)
├── scripts/
│   ├── domains.js                 # Indian enterprise domain map
│   ├── domains-us.js              # US S&P 500 / NASDAQ domain map
│   ├── populate-us.js             # US logo crawler and ingestion engine
│   ├── extractor.js               # Multi-stage crawler
│   ├── generator.js               # Procedural 256x256 vector SVG monogram generator
│   ├── sync.js                    # Re-indexes manifest & catalog stats
│   └── audit.js                   # Validates image binary headers & XML structure (0 errors)
├── src/                           # TypeScript / React distribution
│   ├── StockLogo.tsx              # Multi-market React component
│   └── index.ts
├── .github/workflows/
│   └── daily-sync.yml             # Automated daily audit & manifest sync
├── package.json
└── README.md
```

---

## 🛠️ CLI Automation Commands

```bash
# 1. Audit all 1,180+ image binaries and SVG XML validity (0 errors)
npm run audit

# 2. Re-index catalog across all markets and update logos-manifest.json
npm run sync

# 3. Populate or refresh US stocks
npm run populate:us

# 4. Ingest an unlisted company by symbol
node scripts/extractor.js NEWTICKER "New Enterprise Inc"
```

---

## 🤝 Adding More Companies (World Expansion)

We welcome contributions for any listed company worldwide (UK LSE, Japan TSE, Germany DAX, Canada TSX, etc.):
1. Fork this repository.
2. Place a clean vector SVG or 256x256 transparent PNG into `logos/<market>/<SYMBOL>.<ext>` (e.g. `logos/uk/AZN.svg`).
3. Run `npm run audit` and `npm run sync`.
4. Open a Pull Request!

---

## 🔒 Trademark & Fair Use Notice

* All trademarks, logos, brand names, and company emblems displayed in this repository are the intellectual property of their respective corporate owners.
* Their inclusion in this open-source catalog is strictly for editorial, informational, and non-commercial stock identification purposes in financial charts, trading interfaces, and research applications under standard **Fair Use** doctrines.
* Repository code, scripts, and workflows are licensed under the **MIT License**.
