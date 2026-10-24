# Integrations

Ways to show a company logo or read its profile from your own app. All of them use files from the [jsDelivr CDN](https://www.jsdelivr.com/); there is no key and no sign-up. The full API is described in [API.md](./API.md).

## The simplest case: an image tag

```html
<img src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/TCS.svg" width="32" height="32" alt="TCS logo">
```

The path is `logos/<market>/<TICKER>.svg`. Market folders are lower-case (`us`, `in`, `uk`, `japan`, `korea`, ...). The list is in [`logos-manifest.json`](../logos-manifest.json). For 107 older companies only a `.png` exists; the API's `logo.file.url` always gives the right file.

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

## Web component

[`src/stock-logo.js`](../src/stock-logo.js) defines `<stock-logo>`: one ES module, no dependencies, works in any framework or none. It uses the same file layout as the client (`logos/<market>/<TICKER>.svg`, then the older `.png`), loads lazily, and shows an initials badge if no file loads.

<!-- recipe: web-component -->
```html
<script type="module" src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/src/stock-logo.js"></script>

<stock-logo symbol="in:TCS" size="32" name="Tata Consultancy Services"></stock-logo>
<stock-logo symbol="us:AAPL" size="48" theme="dark"></stock-logo>
<stock-logo symbol="korea:005930" size="32" label=""></stock-logo>
```

| Attribute | Meaning |
| :--- | :--- |
| `symbol` | `market:TICKER`, for example `in:TCS`. A bare ticker needs `market` |
| `market` | Market folder, used when `symbol` has no prefix |
| `size` | Pixel size (default 32) |
| `theme` | `auto` (default, follows the visitor's system setting), `light` or `dark`. Logos have one variant, so the theme sets the tile behind the logo (white or near-black) |
| `baseUrl` | Where `logos/` lives; use it for a self-hosted copy |
| `name` | Company name, for the accessible label and the badge initials |
| `label` | Overrides the accessible label; `label=""` marks the logo decorative |
| `loading` | `lazy` (default) or `eager` |

It fires `stock-logo-load` and `stock-logo-error` events. Style it with `--stock-logo-radius`, `--stock-logo-bg` and `--stock-logo-ring`. Types are in `src/stock-logo.d.ts`.

## Design tokens

[`assets/tokens.css`](../assets/tokens.css) and [`assets/tokens.json`](../assets/tokens.json) hold every colour, radius, shadow and easing curve of the catalogue page (light and dark), generated from `assets/style.css` by `npm run tokens`. Dark follows the system unless `<html data-theme="light">` is set; `data-theme="dark"` forces it.

<!-- recipe: tokens -->
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/assets/tokens.css">
<style>
  body { background: var(--bg); color: var(--ink); font: 500 16px/1.6 system-ui, sans-serif; margin: 0; padding: 24px; }
  .note { padding: 16px; border-radius: var(--r-card); background: var(--surface); box-shadow: inset 0 0 0 1px var(--ring), var(--shadow-card); }
  .note a { color: var(--accent); }
</style>
<p class="note">Same colours as the catalogue, in light and dark. <a href="#">A link</a></p>
```

In JavaScript, `tokens.json` gives `{ tokens: { "bg": { group, light, dark }, ... } }`.

## Copy-paste parts

The parts below are plain HTML that use classes from [`assets/style.css`](../assets/style.css), so link that file (it also sets the page background and fonts, so use it on a page of your own or inside an `iframe`). If you only want the values, use the tokens above and write your own CSS. The logo file in each part comes from the same CDN.

### Company card

<!-- recipe: company-card -->
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/assets/style.css">

<div style="width: 220px">
  <a class="card" href="https://www.tcs.com" aria-label="Tata Consultancy Services, TCS, India" style="text-decoration: none">
    <img class="logo" width="56" height="56" loading="lazy" alt="" src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/TCS.svg">
    <span class="tick">TCS</span>
    <span class="nm">Tata Consultancy Services</span>
    <span class="meta"><span class="tag">IN</span></span>
  </a>
</div>
```

Use a `button` instead of `a` for a card that opens something on your page. Fill the name and market cap from the client (`api.company('in', 'TCS')`) and add them in a `<span>` inside `.meta`.

### Logo grid

<!-- recipe: logo-grid -->
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/assets/style.css">

<ul class="grid">
  <li><div class="card"><img class="logo" width="56" height="56" loading="lazy" alt="" src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/us/AAPL.svg"><span class="tick">AAPL</span><span class="nm">Apple</span></div></li>
  <li><div class="card"><img class="logo" width="56" height="56" loading="lazy" alt="" src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/us/MSFT.svg"><span class="tick">MSFT</span><span class="nm">Microsoft</span></div></li>
  <li><div class="card"><img class="logo" width="56" height="56" loading="lazy" alt="" src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/in/TCS.svg"><span class="tick">TCS</span><span class="nm">Tata Consultancy Services</span></div></li>
</ul>
```

The grid fills the width with columns of at least 188 px (two columns on phones).

### Search box

<!-- recipe: search-box -->
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/assets/style.css">

<form role="search" autocomplete="off" style="max-width: 520px">
  <label class="field search">
    <span class="sr">Search by ticker or company</span>
    <svg class="s-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
    <input type="search" placeholder="Ticker or company, for example TCS or Samsung" spellcheck="false">
  </label>
</form>
<ul class="grid" id="hits"></ul>

<script type="module">
  import { StockLogosClient } from 'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/src/client.js';
  const api = new StockLogosClient();
  const hits = document.getElementById('hits');
  document.querySelector('input').addEventListener('input', async (e) => {
    const rows = await api.search(e.target.value, { limit: 8 });
    hits.replaceChildren(...rows.map((r) => {
      const li = document.createElement('li');
      li.innerHTML = '<div class="card"><img class="logo" width="56" height="56" alt=""><span class="tick"></span><span class="nm"></span></div>';
      li.querySelector('img').src = api.logoOf(r);
      li.querySelector('.tick').textContent = r.ticker;
      li.querySelector('.nm').textContent = r.name;
      return li;
    }));
  });
</script>
```

Set `textContent`, never `innerHTML`, for names that come from data.

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
