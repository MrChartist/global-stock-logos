// Global Stock Logos: catalogue page. Uses the public API client (src/client.js); no other dependencies.
import { StockLogosClient, DEFAULT_BASE_URL } from '../src/client.js';

const here = new URL('../', import.meta.url).href.replace(/\/$/, '');
const CDN = new StockLogosClient({ baseUrl: DEFAULT_BASE_URL });
let api = new StockLogosClient({ baseUrl: here }); // this site's own copy first, the CDN as a fallback
const $ = (id) => document.getElementById(id);
const PAGE = 60;

const state = { q: '', market: '', sort: 'cap', all: [], rows: [], shown: 0, marketNames: {} };

// ---------------------------------------------------------------- formatting
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-US');
const fmtUsd = (v) => (v == null ? '—' : usd.format(v));
function fmtInr(v) {
  if (v == null) return '—';
  if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)} lakh crore`;
  if (v >= 1e7) return `₹${num.format(Math.round(v / 1e7))} crore`;
  return `₹${num.format(Math.round(v))}`;
}
function fmtLocal(v, currency) {
  if (v == null) return '—';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2 }).format(v); }
  catch { return `${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v)} ${currency || ''}`.trim(); }
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Only http(s) links are ever put in an href, whatever the data contains.
const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null; } catch { return null; } };
const dash = (v) => (v == null || v === '' ? '<span class="prov">Not available</span>' : esc(v));

// ---------------------------------------------------------------- theme
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch {}
}
// The initial theme is set by the inline script in index.html (before first paint).
$('theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  setTheme(dark ? 'light' : 'dark');
});

// ---------------------------------------------------------------- data
async function load() {
  let index;
  try { index = await api.index(); }
  catch { api = CDN; index = await api.index(); } // not hosted with its own api/ folder: use the CDN copy
  const [markets, rows] = await Promise.all([api.markets(), api.searchRows()]);
  state.all = rows; // raw rows: [ticker, name, market, format, yahooTicker, marketCapUsd]; objects are built only for what is shown
  state.marketNames = Object.fromEntries(markets.map((m) => [m.code, m.country]));
  $('statCompanies').textContent = num.format(index.companies);
  $('statMarkets').textContent = num.format(index.markets);
  $('statRefreshed').textContent = index.dataRefreshedAt;
  const sel = $('market');
  for (const m of markets) {
    const o = document.createElement('option');
    o.value = m.code; o.textContent = `${m.country} (${num.format(m.companies)})`;
    sel.appendChild(o);
  }
}

// ---------------------------------------------------------------- list
function compute() {
  const { q, market, sort } = state;
  let rows;
  if (q.trim()) {
    rows = state.all.length ? searchLocal(q, market) : [];
  } else {
    rows = market ? state.all.filter((r) => r[2] === market) : state.all;
  }
  if (sort === 'name') rows = [...rows].sort((a, b) => a[1].localeCompare(b[1]));
  else if (sort === 'ticker') rows = [...rows].sort((a, b) => a[0].localeCompare(b[0]));
  state.rows = rows;
  state.shown = 0;
  $('results').replaceChildren();
  renderMore();
  const n = rows.length;
  $('count').textContent = n ? `${num.format(n)} ${n === 1 ? 'company' : 'companies'}${market ? ` in ${state.marketNames[market] || market}` : ''}` : '';
  $('empty').hidden = n > 0 || !state.all.length;
}

// Same ranking as the client's search(), on the rows already in memory (no second download).
const fold = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
function searchLocal(query, market) {
  const q = fold(query).trim();
  const hits = [];
  for (const r of state.all) {
    if (market && r[2] !== market) continue;
    const t = fold(r[0]), n = fold(r[1]);
    const s = t === q ? 0 : t.startsWith(q) ? 1 : n.startsWith(q) ? 2 : n.includes(` ${q}`) ? 3 : n.includes(q) ? 4 : -1;
    if (s >= 0) hits.push({ r, s });
  }
  return hits.sort((a, b) => a.s - b.s).map((h) => h.r);
}

function logoSrc(r) { return api.logoOf(r); }
function renderMore() {
  const slice = state.rows.slice(state.shown, state.shown + PAGE);
  const frag = document.createDocumentFragment();
  for (const raw of slice) {
    const r = StockLogosClient.hit(raw);
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card';
    b.setAttribute('aria-label', `${r.name}, ${r.ticker}, ${state.marketNames[r.market] || r.market}`);
    b.innerHTML = `<img class="logo" width="64" height="64" loading="lazy" alt="" src="${esc(logoSrc(r))}">
      <span class="tick">${esc(r.ticker)}</span>
      <span class="nm">${esc(r.name)}</span>
      <span class="meta"><span class="chip">${esc(r.market)}</span><span>${fmtUsd(r.marketCapUsd)}</span></span>`;
    const img = b.querySelector('img');
    img.addEventListener('error', () => { if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = CDN.logoOf(r); } });
    b.addEventListener('click', () => open(r.market, r.ticker));
    li.appendChild(b);
    frag.appendChild(li);
  }
  $('results').appendChild(frag);
  state.shown += slice.length;
  $('more').hidden = state.shown >= state.rows.length;
}
$('more').addEventListener('click', renderMore);
new IntersectionObserver((e) => { if (e[0].isIntersecting && state.shown < state.rows.length && state.shown > 0) renderMore(); }, { rootMargin: '600px' }).observe($('sentinel'));

// ---------------------------------------------------------------- URL state
function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') || ''; state.market = (p.get('market') || '').toUpperCase(); state.sort = ['cap', 'name', 'ticker'].includes(p.get('sort')) ? p.get('sort') : 'cap';
  $('q').value = state.q; $('market').value = state.market; $('sort').value = state.sort;
}
function writeUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.market) p.set('market', state.market);
  if (state.sort !== 'cap') p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}
let timer;
$('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = $('q').value; writeUrl(); compute(); }, 160); });
$('market').addEventListener('change', () => { state.market = $('market').value; writeUrl(); compute(); });
$('sort').addEventListener('change', () => { state.sort = $('sort').value; writeUrl(); compute(); });
$('controls').addEventListener('submit', (e) => e.preventDefault());

// ---------------------------------------------------------------- detail
const dlg = $('detail');
function open(market, ticker) {
  if (location.hash !== `#/${market}/${encodeURIComponent(ticker)}`) history.pushState(null, '', `${location.search}#/${market}/${encodeURIComponent(ticker)}`);
  showDetail(market, ticker);
}
async function showDetail(market, ticker) {
  $('dBody').innerHTML = '<p class="prov">Loading…</p>';
  if (!dlg.open) dlg.showModal();
  try {
    const c = await api.company(market, ticker);
    $('dBody').innerHTML = detailHtml(c);
    $('dBody').querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; } catch { b.textContent = 'Press Ctrl+C'; }
      setTimeout(() => (b.textContent = 'Copy'), 1500);
    }));
    const img = $('dBody').querySelector('img.logo');
    img.addEventListener('error', () => { if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = c.logo.file.url; } });
  } catch {
    $('dBody').innerHTML = '<p class="error">This company could not be loaded.</p>';
  }
}
function officer(p) {
  if (!p) return dash(null);
  return `${esc(p.name)}<small>Source: ${esc(p.source)}</small>${p.confidence === 'low' ? '<span class="note">Community data: may be out of date</span>' : ''}`;
}
function detailHtml(c) {
  const p = c.profile, m = c.marketCap, lg = c.logo;
  const ext = lg.file.format;
  const svg = api.logoUrl(c.market, c.ticker, { format: ext === 'png' ? 'original-png' : 'svg' });
  const cdnSvg = lg.file.url;
  const where = [p.headquarters, p.headquartersLocal].filter(Boolean).join(' · ');
  const addr = [p.address, p.addressLocal].filter(Boolean).join(' · ');
  const sizes = lg.png ? Object.keys(lg.png).sort((a, b) => a - b).map((s) => `<a href="${esc(lg.png[s])}">${s} px PNG</a>`).join('') : '';
  const embed = [
    ['HTML', `<img src="${cdnSvg}" width="32" height="32" alt="${c.name} logo">`],
    ['Markdown', `![${c.name}](${cdnSvg})`],
    ['API', c.links.self],
    ['JavaScript', `const c = await new StockLogosClient().company('${c.market.toLowerCase()}', '${c.ticker}');`],
  ];
  return `
    <div class="d-head">
      <img class="logo" width="96" height="96" alt="${esc(c.name)} logo" src="${esc(svg)}">
      <div>
        <h2 id="dTitle" tabindex="-1">${esc(c.name)}</h2>
        <div class="d-sub">${esc(c.ticker)} · ${esc(c.exchange || c.market)} · ${esc(c.flag || '')} ${esc(c.country || '')}</div>
        ${lg.isPlaceholder ? '<span class="note">Generated badge, not the real logo</span>' : ''}
      </div>
    </div>
    <dl class="kv">
      <div><dt>Market cap (USD)</dt><dd>${fmtUsd(m?.usd)}<small>Approximate, daily exchange rate</small></dd></div>
      <div><dt>Market cap (INR)</dt><dd>${fmtInr(m?.inr)}</dd></div>
      ${m && !['USD', 'INR'].includes(m.currency) ? `<div><dt>Market cap (${esc(m.currency || 'local')})</dt><dd>${fmtLocal(m.local, m.currency)}${m.asOf ? `<small>As of ${esc(m.asOf)}</small>` : ''}</dd></div>` : ''}
      <div><dt>Sector</dt><dd>${dash(c.classification.sector)}${c.classification.industry ? `<small>${esc(c.classification.industry)}</small>` : ''}</dd></div>
      <div><dt>Website</dt><dd>${safeUrl(p.website) ? `<a href="${esc(safeUrl(p.website))}" rel="noopener noreferrer">${esc(p.website.replace(/^https?:\/\//, ''))}</a>` : dash(null)}</dd></div>
      <div><dt>Founded</dt><dd>${dash(p.founded)}</dd></div>
      <div><dt>Listed since</dt><dd>${dash(p.listingDate)}</dd></div>
      <div><dt>Employees</dt><dd>${p.employees ? num.format(p.employees) : dash(null)}</dd></div>
      <div><dt>Headquarters</dt><dd>${where ? esc(where) : dash(null)}${addr ? `<small>${esc(addr)}</small>` : ''}</dd></div>
      <div><dt>CEO</dt><dd>${officer(p.ceo)}</dd></div>
      <div><dt>Chairman</dt><dd>${officer(p.chairman)}</dd></div>
      <div><dt>ISIN</dt><dd>${dash(c.isin)}${c.lei ? `<small>LEI ${esc(c.lei)}</small>` : ''}</dd></div>
      <div><dt>Brand colour</dt><dd>${lg.brandColor ? `<span class="sw"><i style="background:${esc(lg.brandColor)}"></i>${esc(lg.brandColor)}</span><small>From the logo file${lg.brandColorSource === 'neutral-tile' ? ' (black, white or grey logo: low confidence)' : ''}</small>` : dash(null)}</dd></div>
      <div><dt>Quote</dt><dd>${safeUrl(c.links.yahoo) ? `<a href="${esc(safeUrl(c.links.yahoo))}" rel="noopener noreferrer">Yahoo Finance</a>` : dash(null)}${c.wikidata ? `<small><a href="https://www.wikidata.org/wiki/${esc(c.wikidata)}" rel="noopener noreferrer">Wikidata ${esc(c.wikidata)}</a></small>` : ''}</dd></div>
    </dl>
    <h3 class="d-sec">Logo files</h3>
    <div class="sizes"><a href="${esc(svg)}">${ext === 'png' ? 'PNG (original)' : 'SVG'}</a>${sizes}${lg.png ? '' : '<span class="prov">PNG sizes exist for the 3,000 largest companies; other logos are SVG.</span>'}</div>
    <h3 class="d-sec">Use it</h3>
    ${embed.map(([k, v]) => `<div class="snip"><code title="${esc(k)}">${esc(v)}</code><button type="button" data-copy="${esc(v)}" aria-label="Copy ${esc(k)}">Copy</button></div>`).join('')}
    <p class="prov">Profile refreshed ${esc(c.freshness.profile || 'n/a')}; market data ${esc(c.freshness.marketData || 'n/a')}.
      ${c.sources ? `Sources: ${esc(Object.entries(c.sources).map(([k, v]) => `${k} (${v})`).join(', '))}.` : ''}
      Missing values are not available from our sources.</p>`;
}
$('dClose').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => { if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`); });
function fromHash() {
  const m = location.hash.match(/^#\/([^/]+)\/(.+)$/);
  if (m) showDetail(m[1], decodeURIComponent(m[2])); else if (dlg.open) dlg.close();
}
addEventListener('popstate', fromHash);

// ---------------------------------------------------------------- start
(async () => {
  try {
    await load();
    readUrl(); compute();
    if (location.hash) fromHash();
  } catch (e) {
    $('count').textContent = '';
    $('error').hidden = false;
    console.error(e);
  }
})();
