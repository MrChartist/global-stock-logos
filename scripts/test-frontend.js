/**
 * test-frontend.js — Browser smoke test of the catalogue page (index.html) against the built files.
 *   node scripts/test-frontend.js
 * Needs a Chromium: set CHROME_PATH, or it tries the usual Playwright location. Skips cleanly if none is found.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { chromium } from 'playwright-core';
import { ROOT } from './enrich-store.js';

const pw = fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`) : [];
const candidates = [process.env.CHROME_PATH, ...pw, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
const exe = candidates.find((p) => fs.existsSync(p));
if (!exe) { console.log('Frontend check skipped: no Chromium found (set CHROME_PATH).'); process.exit(0); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; } catch (e) { console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`); process.exitCode = 1; } };

for (const [label, size] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport: size });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(base, { waitUntil: 'networkidle' });

    await t(`${label}: catalogue loads and is sorted largest first`, async () => {
        await page.waitForSelector('.card:not(.skel)');
        assert.match(await page.textContent('#count'), /\d{2},\d{3} companies/);
        assert.equal(await page.locator('.card .tick').first().textContent(), 'NVDA');
        assert.ok((await page.locator('#market option').count()) >= 69);
    });
    await t(`${label}: no horizontal overflow`, async () => {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(over <= 0, `page is ${over}px wider than the viewport`);
    });
    await t(`${label}: search and market filter`, async () => {
        await page.fill('#q', 'tata consultancy');
        await page.selectOption('#market', 'IN');
        await page.waitForFunction(() => /1 company in India/.test(document.getElementById('count').textContent));
        assert.equal(await page.locator('.card .tick').first().textContent(), 'TCS');
        assert.match(page.url(), /q=tata\+consultancy/);
        assert.match(page.url(), /market=IN/);
    });
    await t(`${label}: detail opens, shows INR and the curated CEO, and closes with Escape`, async () => {
        await page.click('.card');
        await page.waitForSelector('dialog[open] .kv');
        const text = await page.textContent('dialog');
        assert.match(text, /lakh crore/); assert.match(text, /K\. Krithivasan/); assert.match(text, /curated/); assert.match(text, /INE467B01029/);
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'dTitle', 'focus moves to the company name');
        assert.equal(await page.locator('dialog [data-row="cap-inr"]').count(), 1, 'INR market cap should appear once');
        assert.equal(await page.locator('dialog [data-row="cap-local"]').count(), 0, 'no separate local row when the local currency is INR');
        const over = await page.evaluate(() => { const s = document.querySelector('dialog .sheet'); return s.scrollWidth - s.clientWidth; });
        assert.ok(over <= 0, `detail sheet overflows by ${over}px`);
        assert.match(page.url(), /#\/IN\/TCS/);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        await page.waitForFunction(() => !location.hash);
        assert.match(page.url(), /q=tata\+consultancy/, 'closing the sheet returns to the search');
    });
    await t(`${label}: a low-confidence CEO is marked unverified, with the start of the term`, async () => {
        await page.goto(`${base}/#/US/MSFT`, { waitUntil: 'networkidle' });
        await page.waitForSelector('dialog[open] .kv');
        const text = await page.textContent('dialog');
        assert.match(text, /Unverified community data/); assert.match(text, /since \d{4}/);
        assert.equal(await page.locator('dialog .unverified').count() >= 1, true);
    });
    await t(`${label}: deep links: PNG-only logo, lower case, malformed`, async () => {
        const png = JSON.parse(fs.readFileSync(path.join(ROOT, 'search-index.json'), 'utf-8')).find((r) => r[3] === 'png');
        await page.goto(`${base}/#/${png[2]}/${encodeURIComponent(png[0])}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('dialog[open] img.logo');
        const ok = await page.evaluate(() => { const i = document.querySelector('dialog img.logo'); return i.complete && i.naturalWidth > 0; });
        assert.ok(ok, 'logo image did not load');
        await page.goto(`${base}/#/in/tcs`, { waitUntil: 'networkidle' });
        await page.waitForSelector('dialog[open] .kv');
        assert.match(await page.textContent('dialog h2'), /Tata Consultancy/);
        await page.goto(`${base}/#/IN/%E0%A4`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.card:not(.skel)');
        assert.equal(await page.isHidden('#error'), true, 'a malformed link must not break the page');
    });
    await t(`${label}: exchange spellings, former tickers and unknown markets`, async () => {
        await page.goto(`${base}/?q=m%26m&market=india`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => /Mahindra/.test(document.querySelector('.card .nm')?.textContent || ''));
        assert.equal(await page.inputValue('#market'), 'IN', 'a country name selects its market');
        await page.goto(`${base}/?q=zomato`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.querySelector('.card .tick')?.textContent === 'ETERNAL');
        await page.goto(`${base}/?market=nowhere`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.card:not(.skel)');
        assert.equal(await page.inputValue('#market'), '', 'an unknown market falls back to all markets');
    });
    await t(`${label}: the largest-first view shows main listings, not copies`, async () => {
        const ticks = await page.locator('.card .tick').allTextContents();
        const firstTwenty = ticks.slice(0, 20);
        assert.ok(!firstTwenty.some((x) => /^(1|4)[A-Z]/.test(x) || /^(JPMP|BACP|GOOGM|GOOGN)/.test(x)), `copies in the top 20: ${firstTwenty.join(' ')}`);
    });
    await t(`${label}: unsafe URLs in data never become links`, async () => {
        await page.route('**/api/v1/companies/us/AAPL.json', async (route) => {
            const res = await route.fetch(); const c = await res.json();
            c.profile.website = 'javascript:alert(1)'; c.links.yahoo = 'javascript:alert(2)'; c.name = '<img src=x onerror=alert(3)>';
            await route.fulfill({ response: res, json: c });
        });
        await page.goto(`${base}/#/US/AAPL`, { waitUntil: 'networkidle' });
        await page.waitForSelector('dialog[open] .kv');
        assert.equal(await page.locator('dialog a[href^="javascript:"]').count(), 0);
        assert.equal(await page.locator('dialog img[onerror]').count(), 0);
        await page.unroute('**/api/v1/companies/us/AAPL.json');
    });
    await t(`${label}: light and dark themes both apply, and the toggle works`, async () => {
        const bg = async () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const settle = async (want) => page.waitForFunction((c) => getComputedStyle(document.body).backgroundColor === c, want);
        await page.goto(`${base}/?theme=light`, { waitUntil: 'networkidle' });
        assert.equal(await bg(), 'rgb(249, 248, 245)');
        await page.goto(`${base}/?theme=dark`, { waitUntil: 'networkidle' });
        assert.equal(await bg(), 'rgb(15, 14, 13)');
        assert.equal(await page.evaluate(() => document.documentElement.dataset.resolved), 'dark');
        await page.click('#theme');
        await settle('rgb(249, 248, 245)');
        assert.equal(await page.evaluate(() => document.documentElement.dataset.resolved), 'light');
        await page.click('#theme');
        await settle('rgb(15, 14, 13)');
        await page.evaluate(() => localStorage.removeItem('theme'));
    });
    await t(`${label}: sort control slides and re-sorts; the / key focuses search`, async () => {
        await page.goto(`${base}/?market=IN`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.card');
        await page.click('#sort label:has-text("Ticker")');
        await page.waitForFunction(() => document.getElementById('sort').style.getPropertyValue('--i') === '2');
        const first = await page.locator('.card .tick').first().textContent();
        assert.ok(/^[0-9A-Z]/.test(first));
        assert.match(page.url(), /sort=ticker/);
        await page.mouse.click(5, 300); await page.keyboard.press('/');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'q');
    });
    await t(`${label}: no script errors`, () => assert.deepEqual(errors, []));
    await page.close();
}
await browser.close();
server.close();
console.log(`Frontend check: ${passed} passed${process.exitCode ? ', some FAILED' : ''}.`);
