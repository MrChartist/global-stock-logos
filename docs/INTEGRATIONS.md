# Integrations

Ways to show a company logo or read its profile from your own app. All of them use files from the [jsDelivr CDN](https://www.jsdelivr.com/); there is no key and no sign-up. The full API is described in [API.md](./API.md).

## The simplest case: an image tag

```html
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/TCS.svg" width="32" height="32" alt="TCS logo">
```

The path is `logos/<market>/<TICKER>.svg`. Market folders are lower-case (`us`, `in`, `uk`, `japan`, `korea`, ...). The list is in [`logos-manifest.json`](../logos-manifest.json). For a few older companies (45 in October 2026) only a `.png` exists; the API's `logo.file.url` always gives the right file.

## The typed JavaScript client

```js
import { StockLogosClient } from 'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/src/client.js';

const api = new StockLogosClient();
const tcs = await api.company('in', 'TCS');          // full profile
const hits = await api.search('samsung', { limit: 5 });
const url = api.logoUrl('us', 'AAPL', { format: 'png', size: 128 });
```

Types ship in `src/client.d.ts`. See [API.md](./API.md#javascript-client).

## React and Next.js

[`src/StockLogo.tsx`](../src/StockLogo.tsx) is a small component with a fallback chain: the market SVG, the market PNG, the flat file, and finally a generated monogram, so something always renders. Copy the file into your project (it needs only React).

```tsx
import { StockLogo } from './StockLogo';

<StockLogo symbol="TCS" market="in" size={32} companyName="Tata Consultancy Services" />
<StockLogo symbol="AAPL" market="us" size={48} />
<StockLogo symbol="005930" market="korea" size={32} />
```

| Prop | Meaning |
| :--- | :--- |
| `symbol` | Ticker, as in the market list |
| `market` | A market folder name such as `us`, `in`, `uk`, `korea`; case-insensitive. `AUTO` (default) tries the older flat files, then `in` and `us` |
| `size` | Pixel size (default 32) |
| `companyName` | Used for the tooltip and the fallback monogram |
| `showBadgeFallback` | Show the monogram when no file loads (default true) |

Always pass `market` when you know it: `AUTO` cannot find logos for markets other than India and the US.

To read profile data in a component, use the client:

```tsx
import { StockLogosClient } from '../src/client.js';
const api = new StockLogosClient();
const company = await api.company('us', 'AAPL'); // company.marketCap.usd, company.profile.website, ...
```

## Other platforms

### Plain HTML

```html
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/us/NVDA.svg" width="32" height="32" alt="NVIDIA logo">
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

### Python

```python
import requests

BASE = "https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main"

def company(market: str, ticker: str) -> dict:
    r = requests.get(f"{BASE}/api/v1/companies/{market.lower()}/{ticker}.json", timeout=20)
    r.raise_for_status()
    return r.json()

c = company("in", "TCS")
print(c["name"], c["marketCap"]["usd"], c["logo"]["svg"])
```
