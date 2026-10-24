/**
 * <stock-logo>: a company logo as a web component (zero dependencies, one file, ES module).
 *
 *   <script type="module" src="https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/src/stock-logo.js"></script>
 *   <stock-logo symbol="in:TCS" size="32"></stock-logo>
 *
 * Attributes
 *   symbol   "market:TICKER", for example "in:TCS" or "us:AAPL" (market folders are in logos-manifest.json).
 *            A bare ticker needs the `market` attribute.
 *   market   Market folder, used when `symbol` has no prefix.
 *   size     Pixel size, default 32.
 *   theme    "auto" (default, follows prefers-color-scheme), "light" or "dark". Logos are single-variant, so the
 *            theme chooses the tile behind the logo (white or near-black), not a different logo file.
 *   baseUrl  Where logos/ lives; default is the jsDelivr CDN (same layout as src/client.js).
 *   name     Company name: used as the accessible label and for the fallback initials.
 *   label    Accessible label override. Set label="" to mark the logo decorative.
 *   loading  "lazy" (default) or "eager".
 *
 * File order, matching the client: logos/<market>/<TICKER>.svg, then the older logos/<market>/<TICKER>.png (107
 * companies have only that), then an initials badge. Events: `stock-logo-load` and `stock-logo-error`.
 * Styling: the host is an inline-block; override --stock-logo-radius, --stock-logo-bg, --stock-logo-ring.
 */

export const DEFAULT_BASE_URL = 'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main';

/**
 * @param {{ symbol?: string | null, market?: string | null }} input
 * @returns {{ market: string, ticker: string } | null}
 */
export function parseSymbol({ symbol, market }) {
    const s = String(symbol ?? '').trim();
    if (!s) return null;
    const i = s.indexOf(':');
    const m = (i >= 0 ? s.slice(0, i) : String(market ?? '')).trim().toLowerCase();
    const ticker = (i >= 0 ? s.slice(i + 1) : s).trim();
    return m && ticker ? { market: m, ticker } : null;
}

/**
 * Candidate files in the order they are tried.
 * @param {string} baseUrl @param {string} market @param {string} ticker
 * @returns {string[]}
 */
export function logoCandidates(baseUrl, market, ticker) {
    const b = baseUrl.replace(/\/$/, '');
    const p = `${b}/logos/${encodeURIComponent(market.toLowerCase())}/${encodeURIComponent(ticker)}`;
    return [`${p}.svg`, `${p}.png`];
}

/** Up to two letters for the fallback badge. @param {string} text */
export function initials(text) {
    const words = String(text).trim().split(/[\s._-]+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2);
    return letters.toUpperCase();
}

const STYLE = `
:host { display: inline-block; vertical-align: middle; line-height: 0; --stock-logo-radius: 22%; }
.box { display: grid; place-items: center; width: 100%; height: 100%; overflow: hidden; border-radius: var(--stock-logo-radius);
  background: var(--stock-logo-bg, #fff); box-shadow: inset 0 0 0 1px var(--stock-logo-ring, rgba(26,22,20,.09)); }
:host([theme="dark"]) .box { --stock-logo-bg: #0f0e0d; --stock-logo-ring: rgba(241,235,228,.10); }
@media (prefers-color-scheme: dark) {
  :host(:not([theme])) .box, :host([theme="auto"]) .box { --stock-logo-bg: #0f0e0d; --stock-logo-ring: rgba(241,235,228,.10); }
}
img { width: 100%; height: 100%; object-fit: contain; display: block; }
.badge { width: 100%; height: 100%; display: grid; place-items: center; background: #ece7e1; color: #3a322c;
  font: 700 calc(var(--size) * .38 * 1px)/1 system-ui, sans-serif; letter-spacing: -.02em; }
:host([theme="dark"]) .badge { background: #2a2623; color: #e8e2dc; }
@media (prefers-color-scheme: dark) {
  :host(:not([theme])) .badge, :host([theme="auto"]) .badge { background: #2a2623; color: #e8e2dc; }
}
`;

const Base = /** @type {typeof HTMLElement} */ (globalThis.HTMLElement ?? class {});

export class StockLogoElement extends Base {
    static get observedAttributes() { return ['symbol', 'market', 'size', 'baseurl', 'name', 'label', 'loading', 'theme']; }

    constructor() {
        super();
        this._root = this.attachShadow({ mode: 'open' });
        this._root.innerHTML = `<style>${STYLE}</style><div class="box"></div>`;
        /** @type {HTMLElement} */
        this._box = /** @type {HTMLElement} */ (this._root.querySelector('.box'));
        this._ready = false;
        this._queued = false;
        /** @type {IntersectionObserver | null} */
        this._io = null;
    }

    connectedCallback() { this._ready = true; this._render(); }
    disconnectedCallback() { this._ready = false; this._io?.disconnect(); this._io = null; }
    attributeChangedCallback() { if (this._ready && !this._queued) { this._queued = true; queueMicrotask(() => { this._queued = false; if (this._ready) this._render(); }); } }

    get size() { const n = Number(this.getAttribute('size')); return Number.isFinite(n) && n > 0 ? n : 32; }
    get baseUrl() { return this.getAttribute('baseUrl') ?? DEFAULT_BASE_URL; }

    _render() {
        this._io?.disconnect(); this._io = null;
        const size = this.size;
        this.style.width = `${size}px`; this.style.height = `${size}px`;
        this._box.style.setProperty('--size', String(size));
        const sym = parseSymbol({ symbol: this.getAttribute('symbol'), market: this.getAttribute('market') });
        const name = this.getAttribute('name') || '';
        const label = this.hasAttribute('label') ? this.getAttribute('label') : `${name || sym?.ticker || 'Company'} logo`;
        if (label) { this.setAttribute('role', 'img'); this.setAttribute('aria-label', label); }
        else { this.setAttribute('role', 'presentation'); this.removeAttribute('aria-label'); }
        if (!sym) { this._badge(name || this.getAttribute('symbol') || '?'); return; }
        const urls = logoCandidates(this.baseUrl, sym.market, sym.ticker);
        const start = () => this._load(urls, 0, name || sym.ticker, sym);
        if (this.getAttribute('loading') === 'eager' || typeof IntersectionObserver === 'undefined') { start(); return; }
        this._badge(name || sym.ticker, true); // placeholder of the final size until the logo is near the viewport
        this._io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) { this._io?.disconnect(); this._io = null; start(); }
        }, { rootMargin: '200px' });
        this._io.observe(this);
    }

    /** @param {string} text @param {boolean} [quiet] */
    _badge(text, quiet = false) {
        const b = document.createElement('div');
        b.className = 'badge'; b.setAttribute('aria-hidden', 'true');
        b.textContent = quiet ? '' : initials(text);
        this._box.replaceChildren(b);
    }

    /** @param {string[]} urls @param {number} i @param {string} fallbackText @param {{ market: string, ticker: string }} sym */
    _load(urls, i, fallbackText, sym) {
        if (i >= urls.length) {
            this._badge(fallbackText);
            this.dispatchEvent(new CustomEvent('stock-logo-error', { detail: { ...sym, tried: urls } }));
            return;
        }
        const img = document.createElement('img');
        img.alt = ''; img.decoding = 'async'; img.draggable = false;
        img.addEventListener('load', () => this.dispatchEvent(new CustomEvent('stock-logo-load', { detail: { ...sym, url: urls[i] } })));
        img.addEventListener('error', () => { if (img.isConnected) this._load(urls, i + 1, fallbackText, sym); });
        img.src = urls[i];
        this._box.replaceChildren(img);
    }
}

if (globalThis.customElements && !globalThis.customElements.get('stock-logo')) {
    globalThis.customElements.define('stock-logo', StockLogoElement);
}
