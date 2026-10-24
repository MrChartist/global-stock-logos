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

const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const installed = fs.existsSync(pw) ? fs.readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse().flatMap((d) => [`${pw}/${d}/chrome-linux64/chrome`, `${pw}/${d}/chrome-linux/chrome`]) : [];
const candidates = [process.env.CHROME_PATH, ...installed, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
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
        await page.waitForSelector('.card');
        assert.match(await page.textContent('#count'), /\d\d,\d{3} companies/);
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
    await t(`${label}: detail opens, shows INR and the hand-checked CEO, and closes with Escape`, async () => {
        await page.click('.card');
        await page.waitForSelector('dialog[open] .kv');
        const text = await page.textContent('dialog');
        assert.match(text, /lakh crore/); assert.match(text, /K\. Krithivasan/); assert.match(text, /checked by hand/); assert.match(text, /INE467B01029/);
        assert.equal(await page.locator('dialog [data-row="cap-inr"]').count(), 1, 'INR market cap should appear once');
        assert.equal(await page.locator('dialog [data-row="cap-local"]').count(), 0, 'no separate local row when the local currency is INR');
        const over = await page.evaluate(() => { const s = document.querySelector('dialog .sheet'); return s.scrollWidth - s.clientWidth; });
        assert.ok(over <= 0, `detail sheet overflows by ${over}px`);
        assert.match(page.url(), /#\/IN\/TCS/);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    });
    await t(`${label}: deep link opens a PNG-only company with a working logo`, async () => {
        await page.goto(`${base}/?q=meta&market=US#/US/META`, { waitUntil: 'networkidle' });
        await page.waitForSelector('dialog[open] img.logo');
        const ok = await page.evaluate(() => { const i = document.querySelector('dialog img.logo'); return i.complete && i.naturalWidth > 0; });
        assert.ok(ok, 'logo image did not load');
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
    await t(`${label}: brands load on scroll, filter, and open the parent company`, async () => {
        await page.goto(`${base}/`, { waitUntil: 'networkidle' });
        await page.locator('#brands').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => / of \d+ brands/.test(document.getElementById('bCount').textContent));
        await page.fill('#bq', 'jio');
        await page.waitForFunction(() => /^\d+ of/.test(document.getElementById('bCount').textContent) && document.querySelectorAll('#bResults .bcard').length > 0);
        await page.locator('#bResults .bcard', { has: page.locator('.nm', { hasText: /^Jio$/ }) }).first().click();
        await page.waitForSelector('dialog[open] .kv');
        assert.match(await page.textContent('dialog'), /Reliance Industries/);
        assert.ok(await page.locator('dialog .brands li').count() > 0, 'the parent sheet lists its brands');
        await page.keyboard.press('Escape');
    });
    await t(`${label}: institutions load on scroll and filter`, async () => {
        await page.locator('#institutions').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => / of \d+ institutions/.test(document.getElementById('iCount').textContent));
        await page.fill('#iq', 'sebi');
        await page.waitForFunction(() => /^\d+ of/.test(document.getElementById('iCount').textContent));
        const card = page.locator('#iResults .bcard', { has: page.locator('.nm', { hasText: /^SEBI$/ }) }).first();
        assert.match(await card.getAttribute('href'), /institutions\/(logos|png)\/.*sebi/);
    });
    await t(`${label}: no script errors`, () => assert.deepEqual(errors, []));
    await page.close();
}

// ---------- web component, tokens and the recipes in docs/INTEGRATIONS.md ----------
{
    const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const CDN = 'https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main';
    // The component's default base is the CDN: answer it from the local files so the test needs no network.
    await page.route(`${CDN}/**`, (route) => {
        const f = path.join(ROOT, decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/gh\/[^/]+\/[^/@]+@main/, '')));
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404 });
        return route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    });
    /** Serve an HTML snippet from the local server, with the CDN address swapped for the local one. */
    const show = async (html) => {
        await page.route(`${base}/__recipe`, (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8">${html.split(CDN).join(base)}` }));
        await page.goto(`${base}/__recipe`, { waitUntil: 'networkidle' });
        await page.unroute(`${base}/__recipe`);
    };
    const loaded = (sel) => page.evaluate((s) => { const i = document.querySelector(s).shadowRoot.querySelector('img'); return !!i && i.complete && i.naturalWidth > 0; }, sel);

    await t('stock-logo: loads the SVG, sets size and an accessible name', async () => {
        await show(`<script type="module" src="${base}/src/stock-logo.js"></script>
            <stock-logo id="a" symbol="in:TCS" size="48" name="Tata Consultancy Services" loading="eager"></stock-logo>
            <stock-logo id="b" symbol="TCS" market="IN" loading="eager" label=""></stock-logo>`);
        await page.waitForFunction(() => document.querySelector('#a').shadowRoot.querySelector('img'));
        await page.waitForFunction(() => { const i = document.querySelector('#a').shadowRoot.querySelector('img'); return i.complete && i.naturalWidth > 0; });
        assert.match(await page.evaluate(() => document.querySelector('#a').shadowRoot.querySelector('img').src), /\/logos\/in\/TCS\.svg$/);
        assert.deepEqual(await page.evaluate(() => { const r = document.querySelector('#a').getBoundingClientRect(); return [r.width, r.height]; }), [48, 48]);
        assert.equal(await page.getAttribute('#a', 'aria-label'), 'Tata Consultancy Services logo');
        assert.equal(await page.getAttribute('#a', 'role'), 'img');
        assert.equal(await page.getAttribute('#b', 'role'), 'presentation', 'label="" is decorative');
        assert.ok(await loaded('#b'), 'bare ticker plus market attribute loads');
    });
    await t('stock-logo: falls back SVG, then PNG, then initials', async () => {
        await page.route('**/logos/us/ZZPNG.svg', (r) => r.fulfill({ status: 404 }));
        await page.route('**/logos/us/ZZPNG.png', (r) => r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'png/64/in/TCS.png')) }));
        await show(`<script type="module" src="${base}/src/stock-logo.js"></script>
            <stock-logo id="p" symbol="us:ZZPNG" loading="eager"></stock-logo>
            <stock-logo id="n" symbol="us:NOSUCHCO" name="No Such Company" loading="eager"></stock-logo>
            <stock-logo id="x" symbol="nonsense"></stock-logo>`);
        await page.waitForFunction(() => /ZZPNG\.png$/.test(document.querySelector('#p').shadowRoot.querySelector('img')?.src || ''));
        await page.waitForFunction(() => document.querySelector('#n').shadowRoot.querySelector('.badge')?.textContent === 'NS');
        assert.equal(await page.evaluate(() => document.querySelector('#x').shadowRoot.querySelector('.badge').textContent), 'NO');
        assert.equal(await page.getAttribute('#n', 'aria-label'), 'No Such Company logo');
        await page.unroute('**/logos/us/ZZPNG.svg'); await page.unroute('**/logos/us/ZZPNG.png');
    });
    await t('stock-logo: lazy until near the viewport, then loads; baseUrl and attribute changes apply', async () => {
        await show(`<script type="module" src="${base}/src/stock-logo.js"></script>
            <div style="height:3000px"></div><stock-logo id="l" symbol="us:AAPL"></stock-logo>`);
        await page.waitForFunction(() => document.querySelector('#l').shadowRoot.querySelector('.badge'));
        assert.equal(await page.evaluate(() => !!document.querySelector('#l').shadowRoot.querySelector('img')), false, 'not loaded while far off screen');
        await page.locator('#l').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('#l').shadowRoot.querySelector('img'));
        await page.evaluate(() => document.querySelector('#l').setAttribute('symbol', 'us:MSFT'));
        await page.waitForFunction(() => /MSFT\.svg$/.test(document.querySelector('#l').shadowRoot.querySelector('img')?.src || ''));
        const req = page.waitForRequest('http://127.0.0.1:1/x/logos/us/MSFT.svg');
        await page.evaluate(() => document.querySelector('#l').setAttribute('baseUrl', 'http://127.0.0.1:1/x/'));
        await req;
    });
    await t('stock-logo: theme sets the tile (light, dark, auto follows the system)', async () => {
        await show(`<script type="module" src="${base}/src/stock-logo.js"></script>
            <stock-logo id="l" symbol="in:TCS" theme="light" loading="eager"></stock-logo>
            <stock-logo id="d" symbol="in:TCS" theme="dark" loading="eager"></stock-logo>
            <stock-logo id="a" symbol="in:TCS" loading="eager"></stock-logo>`);
        const tile = (id) => page.evaluate((i) => getComputedStyle(document.querySelector(i).shadowRoot.querySelector('.box')).backgroundColor, id);
        await page.waitForFunction(() => document.querySelector('#a').shadowRoot.querySelector('.box'));
        assert.equal(await tile('#l'), 'rgb(255, 255, 255)');
        assert.equal(await tile('#d'), 'rgb(15, 14, 13)');
        assert.equal(await tile('#a'), 'rgb(255, 255, 255)');
        await page.emulateMedia({ colorScheme: 'dark' });
        assert.equal(await tile('#a'), 'rgb(15, 14, 13)');
        assert.equal(await tile('#l'), 'rgb(255, 255, 255)');
        await page.emulateMedia({ colorScheme: 'light' });
    });
    await t('tokens.css: light, forced dark and system dark values match the page', async () => {
        const html = '<link rel="stylesheet" href="/assets/tokens.css"><body style="background:var(--bg)">';
        const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        await show(html);
        assert.equal(await bg(), 'rgb(249, 248, 245)');
        await page.emulateMedia({ colorScheme: 'dark' });
        assert.equal(await bg(), 'rgb(15, 14, 13)');
        await page.evaluate(() => document.documentElement.dataset.theme = 'light');
        assert.equal(await bg(), 'rgb(249, 248, 245)');
        await page.emulateMedia({ colorScheme: 'light' });
        await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
        assert.equal(await bg(), 'rgb(15, 14, 13)');
    });

    // Every recipe in docs/INTEGRATIONS.md renders, loads its logos, and does not overflow.
    const md = fs.readFileSync(path.join(ROOT, 'docs/INTEGRATIONS.md'), 'utf8');
    const recipes = [...md.matchAll(/<!-- recipe: ([\w-]+) -->\n```html\n([\s\S]*?)```/g)].map((m) => ({ name: m[1], html: m[2] }));
    await t('docs: the five recipes are present', () => assert.deepEqual(recipes.map((r) => r.name), ['web-component', 'tokens', 'company-card', 'logo-grid', 'search-box']));
    for (const r of recipes) {
        await t(`docs recipe "${r.name}" renders`, async () => {
            await show(r.html);
            await page.waitForTimeout(300);
            if (r.name === 'web-component') {
                await page.waitForFunction(() => [...document.querySelectorAll('stock-logo')].every((e) => e.shadowRoot.querySelector('img')));
                assert.equal(await page.locator('stock-logo').count(), 3);
            } else if (r.name === 'tokens') {
                assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(249, 248, 245)');
                assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.note')).borderRadius), '22px');
            } else if (r.name === 'search-box') {
                await page.fill('input', 'tata consultancy');
                await page.waitForSelector('#hits .card .tick');
                assert.equal(await page.locator('#hits .card .tick').first().textContent(), 'TCS');
            }
            if (['company-card', 'logo-grid', 'search-box'].includes(r.name)) {
                await page.waitForFunction(() => [...document.querySelectorAll('img.logo')].every((i) => i.complete && i.naturalWidth > 0));
                assert.ok(await page.locator('img.logo').count() > 0);
                assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.card')).borderRadius), '22px', 'style.css classes apply');
            }
            assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'no horizontal overflow');
        });
    }
    await t('components: no script errors', () => assert.deepEqual(errors, []));
    await page.close();
}
await browser.close();
server.close();
console.log(`Frontend check: ${passed} passed${process.exitCode ? ', some FAILED' : ''}.`);
