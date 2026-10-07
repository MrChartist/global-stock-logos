/**
 * test-client.js — Run the API client against the built files, served by a throw-away local server.
 *   node scripts/test-client.js
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { ROOT } from './enrich-store.js';
import { StockLogosClient, ApiError } from '../src/client.js';

const TYPES = { '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const api = new StockLogosClient({ baseUrl: base });
let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; } catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } };

await t('index', async () => { const i = await api.index(); assert.equal(i.version, 'v1'); assert.ok(i.companies > 70000); assert.ok(i.markets >= 60); });
await t('markets', async () => { const m = await api.markets(); assert.ok(m.length >= 60); assert.ok(m.every((x) => x.key && x.country && x.companies > 0)); assert.ok(m[0].companies >= m[m.length - 1].companies); });
await t('market list is largest first', async () => { const l = await api.market('us'); assert.ok(l.length > 10000); assert.ok(l[0].marketCapUsd >= l[100].marketCapUsd); });
await t('company profile', async () => {
    const c = await api.company('in', 'TCS');
    assert.equal(c.ticker, 'TCS'); assert.equal(c.market, 'IN'); assert.equal(c.marketCap.currency, 'INR');
    assert.ok(c.marketCap.usd > 1e9 && c.marketCap.inr > c.marketCap.usd);
    assert.match(c.logo.svg, /logos\/in\/TCS\.svg$/); assert.match(c.logo.brandColor, /^#[0-9A-F]{6}$/);
});
await t('company is case-insensitive on market', async () => assert.equal((await api.company('US', 'AAPL')).ticker, 'AAPL'));
await t('top rows are the first rows of the full index and much smaller', async () => {
    const [top, full] = await Promise.all([api.topRows(), api.searchRows()]);
    assert.equal(top.length, 2000); assert.deepEqual(top[0], full[0]); assert.deepEqual(top[1999], full[1999]);
});
await t('search ranks exact ticker first', async () => { const h = await api.search('aapl', { market: 'us' }); assert.equal(h[0].ticker, 'AAPL'); });
await t('search by name', async () => { const h = await api.search('tata consultancy', { market: 'in', limit: 5 }); assert.ok(h.some((x) => x.ticker === 'TCS')); });
await t('search limit and empty query', async () => { assert.equal((await api.search('a', { limit: 7 })).length, 7); assert.deepEqual(await api.search('   '), []); });
await t('search finds exchange spellings and former tickers', async () => {
    assert.match((await api.search('m&m', { market: 'in', limit: 1 }))[0].name, /Mahindra/);
    assert.equal((await api.search('zomato', { limit: 1 }))[0].ticker, 'ETERNAL');
    assert.equal((await api.search('bajaj-auto', { limit: 1 }))[0].market, 'IN');
});
await t('search puts the home listing above copies elsewhere', async () => {
    assert.equal((await api.search('lvmh', { limit: 1 }))[0].ticker, 'MC');
    assert.equal((await api.search('toyota', { limit: 1 }))[0].ticker, '7203');
    const nvda = await api.search('nvda', { limit: 5 });
    assert.equal(nvda[0].market, 'US'); assert.ok(nvda.slice(1).every((h) => h.secondaryListing));
});
await t('market lists: main listings first, copies after', async () => {
    const l = await api.market('chile');
    const firstCopy = l.findIndex((r) => r.secondaryListing);
    assert.ok(firstCopy > 0 && l.slice(firstCopy).every((r) => r.secondaryListing));
});
await t('officers carry a start date; curated values name their source', async () => {
    const tcs = await api.company('in', 'TCS');
    assert.equal(tcs.profile.ceo.source, 'curated'); assert.equal(tcs.profile.ceo.confidence, 'medium'); assert.equal(tcs.profile.ceo.since, '2023-06-01');
    const msft = await api.company('us', 'MSFT');
    assert.equal(msft.profile.ceo.confidence, 'low'); assert.match(msft.profile.ceo.since, /^\d{4}-\d{2}-\d{2}$/);
});
await t('market cap in the reporting currency converts exactly', async () => {
    const tcs = await api.company('in', 'TCS');
    assert.equal(tcs.marketCap.inr, Math.round(tcs.marketCap.local));
});
await t('an alias file says which company it repeats', async () => {
    const z = await api.company('in', 'ZOMATO');
    assert.equal(z.aliasOf, 'ETERNAL'); assert.equal((await api.company('in', 'ETERNAL')).aliasOf, null);
});
await t('unknown company is a typed 404', async () => { await assert.rejects(() => api.company('in', 'NOSUCHTICKER'), (e) => e instanceof ApiError && e.status === 404); });
await t('failures are not cached', async () => { await assert.rejects(() => api.company('in', 'NOSUCHTICKER')); });
await t('logo urls', () => {
    assert.equal(api.logoUrl('IN', 'TCS'), `${base}/logos/in/TCS.svg`);
    assert.equal(api.logoUrl('us', 'AAPL', { format: 'png', size: 128 }), `${base}/png/128/us/AAPL.png`);
});
await t('png-only companies resolve to their real file', async () => {
    const hit = (await api.searchIndex()).find((h) => h.format === 'png');
    assert.ok(hit, 'expected at least one PNG-only company');
    assert.equal((await fetch(api.logoOf(hit))).status, 200);
    const c = await api.company(hit.market, hit.ticker);
    assert.equal(c.logo.svg, null); assert.equal(c.logo.file.format, 'png');
});
await t('logo and png files exist', async () => {
    assert.equal((await fetch(api.logoUrl('us', 'AAPL'))).status, 200);
    assert.equal((await fetch(api.logoUrl('us', 'AAPL', { format: 'png', size: 512 }))).status, 200);
});
server.close();
console.log(`Client check: ${passed} passed${process.exitCode ? ', some FAILED' : ''}.`);
