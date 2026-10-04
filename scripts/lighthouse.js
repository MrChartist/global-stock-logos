/**
 * lighthouse.js — Lighthouse scores for the catalogue page: mobile and desktop, light and dark colour scheme.
 *   node scripts/lighthouse.js            # prints scores and every audit that falls short
 *   node scripts/lighthouse.js --min 100  # exit 1 if any category is below the number (default 100)
 * Needs a Chromium: CHROME_PATH, or the usual Playwright location.
 */
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { ROOT } from './enrich-store.js';

const min = parseInt(process.argv.includes('--min') ? process.argv[process.argv.indexOf('--min') + 1] : '100', 10);
const exe = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean).find((p) => fs.existsSync(p));
if (!exe) { console.log('Lighthouse skipped: no Chromium found (set CHROME_PATH).'); process.exit(0); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const root = `http://127.0.0.1:${server.address().port}/`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-'));

const runs = [
    ['mobile light', [], 'light'], ['mobile dark', [], 'dark'],
    ['desktop light', ['--preset=desktop'], 'light'], ['desktop dark', ['--preset=desktop'], 'dark'],
];
let worst = 100;
for (const [name, extra, scheme] of runs) {
    const out = path.join(tmp, `${name.replace(' ', '-')}.json`);
    // Asynchronous on purpose: the local server above runs in this process and must keep answering Lighthouse.
    const err = await new Promise((resolve) => {
        const child = spawn('npx', ['lighthouse', `${root}?theme=${scheme}`, '--quiet', '--output=json', `--output-path=${out}`,
            `--chrome-flags=--headless=new --no-sandbox --disable-gpu`, ...extra],
        { env: { ...process.env, CHROME_PATH: exe } });
        let stderr = '';
        child.stderr.on('data', (c) => { stderr += c; });
        const timer = setTimeout(() => child.kill('SIGKILL'), 240000);
        child.on('close', () => { clearTimeout(timer); resolve(stderr.slice(-400)); });
    });
    if (!fs.existsSync(out)) { console.error(`${name}: lighthouse failed\n${err}`); process.exitCode = 1; continue; }
    const d = JSON.parse(fs.readFileSync(out, 'utf-8'));
    const scores = Object.fromEntries(Object.entries(d.categories).map(([k, v]) => [k.replace('best-practices', 'practices'), Math.round(v.score * 100)]));
    worst = Math.min(worst, ...Object.values(scores));
    const a = d.audits;
    console.log(`\n${name.padEnd(14)} ${Object.entries(scores).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
    console.log(`               FCP ${a['first-contentful-paint'].displayValue} | LCP ${a['largest-contentful-paint'].displayValue} | TBT ${a['total-blocking-time'].displayValue} | CLS ${a['cumulative-layout-shift'].displayValue}`);
    for (const cat of Object.values(d.categories)) {
        for (const ref of cat.auditRefs) {
            const au = a[ref.id];
            if (ref.weight > 0 && au.score !== null && au.score < 0.9) console.log(`   - [${cat.id}] ${au.title}${au.displayValue ? ` (${au.displayValue})` : ''}`);
        }
    }
}
server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nLowest score: ${worst}`);
if (worst < min) process.exitCode = 1;
