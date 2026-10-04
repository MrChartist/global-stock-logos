// Global Stock Logos: catalogue page. Uses the public API client (src/client.js); no other dependencies.
import { StockLogosClient, DEFAULT_BASE_URL } from '../src/client.js';

const here = new URL('../', import.meta.url).href.replace(/\/$/, '');
const CDN = new StockLogosClient({ baseUrl: DEFAULT_BASE_URL });
let api = new StockLogosClient({ baseUrl: here }); // this site's own copy first, the CDN as a fallback
const $ = (id) => document.getElementById(id);
const PAGE = 60;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// partial = only the top 2,000 rows are loaded so far; the full index is fetched on demand (see ensureFull).
const state = { q: '', market: '', sort: 'cap', all: [], rows: [], shown: 0, marketNames: {}, partial: true, total: 0, fullPromise: null };
const needsFull = () => Boolean(state.q.trim() || state.market || state.sort !== 'cap');

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
const na = '<span class="na">Not available</span>';
const val = (v) => (v == null || v === '' ? na : esc(v));

// ---------------------------------------------------------------- theme
// The initial theme is set by the inline script in index.html (before first paint).
function applyTheme(mode) {
  const d = document.documentElement;
  d.dataset.theme = mode; d.dataset.resolved = mode;
  try { localStorage.setItem('theme', mode); } catch {}
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', mode === 'dark' ? '#0F0E0D' : '#F9F8F5'));
}
$('theme').addEventListener('click', (e) => {
  const next = document.documentElement.dataset.resolved === 'dark' ? 'light' : 'dark';
  if (!document.startViewTransition || reduceMotion.matches) { applyTheme(next); return; }
  // Circular reveal from the button, as an iOS/macOS-style appearance change.
  const r = e.currentTarget.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const t = document.startViewTransition(() => applyTheme(next));
  t.ready.then(() => document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: 650, easing: 'cubic-bezier(.22, 1, .36, 1)', pseudoElement: '::view-transition-new(root)' },
  )).catch(() => {});
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
  let saved = null; try { saved = localStorage.getItem('theme'); } catch {}
  if (!saved) { document.documentElement.dataset.resolved = e.matches ? 'dark' : 'light'; }
});

// ---------------------------------------------------------------- data
async function load() {
  let index;
  try { index = await api.index(); }
  catch { api = CDN; index = await api.index(); } // not hosted with its own api/ folder: use the CDN copy
  const [markets, top] = await Promise.all([api.markets(), api.topRows()]);
  state.all = top; // raw rows: [ticker, name, market, format, yahooTicker, marketCapUsd]; objects are built only for what is shown
  state.total = index.companies;
  state.marketNames = Object.fromEntries(markets.map((m) => [m.code, m.country]));
  // The full index (5 MB) loads on demand (search, market, sort, or reaching the end of the top list) or when the browser is idle.
  $('statCompanies').textContent = num.format(index.companies);
  $('statMarkets').textContent = num.format(index.markets);
  $('statRefreshed').textContent = index.dataRefreshedAt;
  $('liveText').textContent = `${num.format(index.companies)} companies · ${index.markets} markets`;
  const sel = $('market');
  for (const m of markets) {
    const o = document.createElement('option');
    o.value = m.code; o.textContent = `${m.country} (${num.format(m.companies)})`;
    sel.appendChild(o);
  }
}

// ---------------------------------------------------------------- list
function skeleton() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 12; i++) {
    const li = document.createElement('li');
    li.innerHTML = '<div class="card skel" aria-hidden="true"></div>';
    frag.appendChild(li);
  }
  $('results').replaceChildren(frag);
}

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
// Same ranking as the client's search(), on the rows already in memory (no second download).
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

function setCount() {
  const { market } = state;
  const n = !needsFull() && state.partial ? state.total : state.rows.length;
  $('count').textContent = n ? `${num.format(n)} ${n === 1 ? 'company' : 'companies'}${market ? ` in ${state.marketNames[market] || market}` : ''}` : '';
  $('empty').hidden = n > 0 || !state.all.length;
}

let seq = 0;
const seqBusy = () => false;

// The first screens come from the 158 KB top file. The 5 MB full index is fetched only when something needs it,
// so it never competes with the first paint, and parsing it never blocks the page while it is being read.
function ensureFull() {
  if (state.fullPromise) return state.fullPromise;
  state.fullPromise = api.searchRows().then((rows) => {
    state.all = rows; state.partial = false;
    if (needsFull()) compute();
    else { state.rows = rows; $('more').hidden = state.shown >= rows.length; setCount(); }
    return rows;
  });
  state.fullPromise.catch(() => { state.fullPromise = null; });
  return state.fullPromise;
}
// Warm it up when the browser has nothing else to do.
setTimeout(() => { if ('requestIdleCallback' in window) requestIdleCallback(() => ensureFull(), { timeout: 3000 }); else ensureFull(); }, 8000);
function compute() {
  ++seq;
  const partialNow = needsFull() && state.partial;
  if (partialNow) ensureFull(); // results appear at once from the top 2,000 and are refined when everything has loaded
  const { q, market, sort } = state;
  let rows;
  if (q.trim()) rows = state.all.length ? searchLocal(q, market) : [];
  else rows = market ? state.all.filter((r) => r[2] === market) : state.all;
  if (sort === 'name') rows = [...rows].sort((a, b) => a[1].localeCompare(b[1]));
  else if (sort === 'ticker') rows = [...rows].sort((a, b) => a[0].localeCompare(b[0]));
  state.rows = rows;
  state.shown = 0;
  $('results').replaceChildren();
  renderMore();
  setCount();
  if (partialNow) $('count').textContent += ' so far · searching all companies…';
}

function renderMore() {
  const slice = state.rows.slice(state.shown, state.shown + PAGE);
  const frag = document.createDocumentFragment();
  slice.forEach((raw, k) => {
    const r = StockLogosClient.hit(raw);
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card'; b.style.setProperty('--i', k);
    b.setAttribute('aria-label', `${r.name}, ${r.ticker}, ${state.marketNames[r.market] || r.market}`);
    b.innerHTML = `<img class="logo" width="56" height="56" loading="lazy" decoding="async" alt="" src="${esc(api.logoOf(r))}">
      <span class="tick">${esc(r.ticker)}</span>
      <span class="nm">${esc(r.name)}</span>
      <span class="meta"><span class="tag">${esc(r.market)}</span><span>${fmtUsd(r.marketCapUsd)}</span></span>`;
    const img = b.querySelector('img');
    img.addEventListener('error', () => { if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = CDN.logoOf(r); } });
    b.addEventListener('click', () => open(r.market, r.ticker));
    li.appendChild(b);
    frag.appendChild(li);
  });
  $('results').appendChild(frag);
  state.shown += slice.length;
  $('more').hidden = state.shown >= state.rows.length && !state.partial;
}
$('more').addEventListener('click', async () => {
  if (state.shown >= state.rows.length && state.partial) { $('more').disabled = true; try { await ensureFull(); } catch {} $('more').disabled = false; }
  renderMore();
});
new IntersectionObserver((e) => { if (e[0].isIntersecting && state.shown < state.rows.length && state.shown > 0 && !seqBusy()) renderMore(); }, { rootMargin: '600px' }).observe($('sentinel'));

// ---------------------------------------------------------------- controls and URL state
const seg = $('sort');
function setSeg(value) {
  const inputs = [...seg.querySelectorAll('input')];
  const i = Math.max(0, inputs.findIndex((x) => x.value === value));
  inputs[i].checked = true;
  seg.style.setProperty('--i', i);
}
function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') || ''; state.market = (p.get('market') || '').toUpperCase();
  state.sort = ['cap', 'name', 'ticker'].includes(p.get('sort')) ? p.get('sort') : 'cap';
  $('q').value = state.q; $('market').value = state.market; setSeg(state.sort);
}
function writeUrl() {
  const p = new URLSearchParams(location.search);
  for (const k of ['q', 'market', 'sort']) p.delete(k);
  if (state.q) p.set('q', state.q);
  if (state.market) p.set('market', state.market);
  if (state.sort !== 'cap') p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}
let timer;
$('q').addEventListener('focus', () => ensureFull());
$('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = $('q').value; writeUrl(); compute(); }, 160); });
$('market').addEventListener('change', () => { state.market = $('market').value; writeUrl(); compute(); });
seg.addEventListener('change', (e) => { state.sort = e.target.value; setSeg(state.sort); writeUrl(); compute(); });
$('controls').addEventListener('submit', (e) => e.preventDefault());

function focusSearch() {
  const q = $('q');
  q.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
  q.focus({ preventScroll: true });
}
$('searchBtn').addEventListener('click', focusSearch);
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if ((e.key === '/' && !typing && !dlg.open) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); focusSearch(); }
});

// ---------------------------------------------------------------- detail sheet
const dlg = $('detail');
const sheet = dlg.querySelector('.sheet');
function open(market, ticker) {
  if (location.hash !== `#/${market}/${encodeURIComponent(ticker)}`) history.pushState(null, '', `${location.search}#/${market}/${encodeURIComponent(ticker)}`);
  showDetail(market, ticker);
}
function closeSheet() {
  if (!dlg.open) return;
  if (reduceMotion.matches) { dlg.close(); return; }
  dlg.classList.add('closing');
  setTimeout(() => { dlg.classList.remove('closing'); sheet.style.transform = ''; dlg.close(); }, 220);
}
async function showDetail(market, ticker) {
  $('dBody').innerHTML = '<p class="prov">Loading…</p>';
  sheet.style.setProperty('--brand', 'transparent');
  if (!dlg.open) dlg.showModal();
  try {
    const c = await api.company(market, ticker);
    if (c.logo.brandColor && c.logo.brandColorSource !== 'neutral-tile') sheet.style.setProperty('--brand', c.logo.brandColor);
    $('dBody').innerHTML = detailHtml(c);
    $('dBody').querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      const label = b.querySelector('span');
      try { await navigator.clipboard.writeText(b.dataset.copy); label.textContent = 'Copied'; b.classList.add('done'); } catch { label.textContent = 'Press Ctrl+C'; }
      setTimeout(() => { label.textContent = 'Copy'; b.classList.remove('done'); }, 1600);
    }));
    const img = $('dBody').querySelector('img.logo');
    img.addEventListener('error', () => { if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = c.logo.file.url; } });
  } catch {
    $('dBody').innerHTML = '<p class="error">This company could not be loaded.</p>';
  }
}
function officer(p) {
  if (!p) return na;
  return `${esc(p.name)}<small>Source: ${esc(p.source)}</small>${p.confidence === 'low' ? '<span class="note">Community data: may be out of date</span>' : ''}`;
}
const row = (label, html, attr = '') => `<div class="row"${attr}><dt>${label}</dt><dd>${html}</dd></div>`;
function detailHtml(c) {
  const p = c.profile, m = c.marketCap, lg = c.logo;
  const ext = lg.file.format;
  const svg = api.logoUrl(c.market, c.ticker, { format: ext === 'png' ? 'original-png' : 'svg' });
  const cdnSvg = lg.file.url;
  const where = [p.headquarters, p.headquartersLocal].filter(Boolean).join(' · ');
  const addr = [p.address, p.addressLocal].filter(Boolean).join(' · ');
  const site = safeUrl(p.website);
  const sizes = lg.png ? Object.keys(lg.png).sort((a, b) => a - b).map((s) => `<a href="${esc(lg.png[s])}">${s} px PNG</a>`).join('') : '';
  const embed = [
    ['HTML', `<img src="${cdnSvg}" width="32" height="32" alt="${c.name} logo">`],
    ['Markdown', `![${c.name}](${cdnSvg})`],
    ['API', c.links.self],
    ['JavaScript', `const c = await new StockLogosClient().company('${c.market.toLowerCase()}', '${c.ticker}');`],
  ];
  const capRows = m ? [
    row('USD', fmtUsd(m.usd), ' data-row="cap-usd"'),
    row('INR', fmtInr(m.inr), ' data-row="cap-inr"'),
    !['USD', 'INR'].includes(m.currency) ? row(esc(m.currency || 'Local'), fmtLocal(m.local, m.currency) + (m.asOf ? `<small>As of ${esc(m.asOf)}</small>` : ''), ' data-row="cap-local"') : '',
  ].join('') : row('Market cap', na);
  return `
    <div class="d-head">
      <img class="logo" width="88" height="88" alt="${esc(c.name)} logo" src="${esc(svg)}">
      <div>
        <h2 id="dTitle" tabindex="-1">${esc(c.name)}</h2>
        <div class="d-sub">${esc(c.ticker)} · ${esc(c.exchange || c.market)} · ${esc(c.flag || '')} ${esc(c.country || '')}</div>
        ${lg.isPlaceholder ? '<span class="note">Generated badge, not the real logo</span>' : ''}
      </div>
    </div>
    <div class="d-cap">
      <div class="big">${fmtUsd(m?.usd)}</div>
      <span class="sub">Market cap in USD. Approximate, at the daily exchange rate.</span>
    </div>
    <div class="kv">
      <section class="group"><h3>Market cap</h3><dl class="rows">${capRows}</dl></section>
      <section class="group"><h3>Company</h3><dl class="rows">
        ${row('Sector', val(c.classification.sector) + (c.classification.industry ? `<small>${esc(c.classification.industry)}</small>` : ''))}
        ${row('Website', site ? `<a href="${esc(site)}" rel="noopener noreferrer">${esc(p.website.replace(/^https?:\/\//, ''))}</a>` : na)}
        ${row('Founded', val(p.founded))}
        ${row('Listed since', val(p.listingDate))}
        ${row('Employees', p.employees ? num.format(p.employees) : na)}
        ${row('Headquarters', (where ? esc(where) : na) + (addr ? `<small>${esc(addr)}</small>` : ''))}
      </dl></section>
      <section class="group"><h3>People</h3><dl class="rows">
        ${row('CEO', officer(p.ceo))}
        ${row('Chairman', officer(p.chairman))}
      </dl></section>
      <section class="group"><h3>Identifiers</h3><dl class="rows">
        ${row('ISIN', val(c.isin))}
        ${c.lei ? row('LEI', esc(c.lei)) : ''}
        ${row('Quote', safeUrl(c.links.yahoo) ? `<a href="${esc(safeUrl(c.links.yahoo))}" rel="noopener noreferrer">Yahoo Finance</a>` : na)}
        ${c.wikidata ? row('Wikidata', `<a href="https://www.wikidata.org/wiki/${esc(c.wikidata)}" rel="noopener noreferrer">${esc(c.wikidata)}</a>`) : ''}
      </dl></section>
      <section class="group"><h3>Logo</h3><dl class="rows">
        ${row('Brand colour', lg.brandColor ? `<span class="sw"><i style="background:${esc(lg.brandColor)}"></i>${esc(lg.brandColor)}</span><small>From the logo file${lg.brandColorSource === 'neutral-tile' ? ' (black, white or grey logo: low confidence)' : ''}</small>` : na)}
      </dl>
      <div class="rows" style="margin-top:8px"><div class="files"><a href="${esc(svg)}">${ext === 'png' ? 'PNG (original)' : 'SVG'}</a>${sizes}${lg.png ? '' : '<span class="prov">PNG sizes exist for the 3,000 largest companies; other logos are SVG.</span>'}</div></div></section>
      <section class="group"><h3>Use it</h3><div class="rows">
        ${embed.map(([k, v]) => `<div class="snip"><span class="k">${esc(k)}</span><code title="${esc(k)}">${esc(v)}</code><button type="button" class="copy" data-copy="${esc(v)}" aria-label="Copy ${esc(k)}"><span>Copy</span></button></div>`).join('')}
      </div></section>
    </div>
    <p class="prov d-foot">Profile refreshed ${esc(c.freshness.profile || 'n/a')}; market data ${esc(c.freshness.marketData || 'n/a')}.
      ${c.sources ? `Sources: ${esc(Object.entries(c.sources).map(([k, v]) => `${k} (${v})`).join(', '))}.` : ''}
      Missing values are not available from our sources.</p>`;
}
$('dClose').addEventListener('click', closeSheet);
dlg.addEventListener('click', (e) => { if (e.target === dlg) closeSheet(); });
dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); }); // Escape: animate out, then close
dlg.addEventListener('close', () => { if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`); });

// Drag the grabber down to dismiss (phones).
(function () {
  const grab = $('grab');
  let startY = null, dy = 0;
  grab.addEventListener('pointerdown', (e) => { startY = e.clientY; dy = 0; grab.setPointerCapture(e.pointerId); sheet.style.transition = 'none'; });
  grab.addEventListener('pointermove', (e) => { if (startY == null) return; dy = Math.max(0, e.clientY - startY); sheet.style.transform = `translateY(${dy}px)`; });
  const end = () => {
    if (startY == null) return;
    startY = null; sheet.style.transition = 'transform .3s cubic-bezier(.32,.72,0,1)';
    if (dy > 120) { sheet.style.transform = 'translateY(100%)'; setTimeout(() => { sheet.style.transform = ''; sheet.style.transition = ''; dlg.close(); }, 260); }
    else { sheet.style.transform = ''; setTimeout(() => { sheet.style.transition = ''; }, 320); }
  };
  grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
})();

function fromHash() {
  const m = location.hash.match(/^#\/([^/]+)\/(.+)$/);
  if (m) showDetail(m[1], decodeURIComponent(m[2])); else if (dlg.open) closeSheet();
}
addEventListener('popstate', fromHash);

// ---------------------------------------------------------------- start
(async () => {
  skeleton();
  try {
    await load();
    readUrl(); compute();
    if (location.hash) fromHash();
  } catch (e) {
    $('results').replaceChildren();
    $('count').textContent = '';
    $('error').hidden = false;
    console.error(e);
  }
})();
