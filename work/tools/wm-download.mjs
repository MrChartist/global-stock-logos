// Central, polite Wikimedia downloader: one request at a time, honours Retry-After.
// Reads .work/wm-queue/<job>.tsv ("name<TAB>url" per line; url = upload.wikimedia.org original
// or https://commons.wikimedia.org/wiki/Special:FilePath/<File>.svg or https://en.wikipedia.org/wiki/Special:FilePath/<File>.svg).
// Writes .work/wm-dl/<job>/<name>.svg and .work/wm-dl/status.json. Run: node .work/wm-download.mjs
import fs from 'fs';
import path from 'path';

const BASE = path.dirname(new URL(import.meta.url).pathname);
const Q = path.join(BASE, 'wm-queue'), OUT = path.join(BASE, 'wm-dl');
const UA = 'GlobalStockLogos/3.0 (https://github.com/MrChartist/global-stock-logos; contact@mrchartist.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const statusFile = path.join(OUT, 'status.json');
fs.mkdirSync(OUT, { recursive: true });
const status = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile, 'utf-8')) : {};
const save = () => fs.writeFileSync(statusFile, JSON.stringify(status, null, 1));

const items = [];
for (const f of fs.readdirSync(Q).filter((x) => x.endsWith('.tsv'))) {
    const job = f.replace(/\.tsv$/, '');
    for (const line of fs.readFileSync(path.join(Q, f), 'utf-8').split('\n')) {
        const [name, url] = line.split('\t').map((s) => s && s.trim());
        if (!name || !url || name.startsWith('#')) continue;
        items.push({ job, name: name.replace(/[^\w.-]+/g, '_'), url });
    }
}
const todo = items.filter((i) => status[`${i.job}/${i.name}`] !== 'ok' && status[`${i.job}/${i.name}`] !== 'notfound');
console.log(`${items.length} queued, ${todo.length} to fetch`);

let gap = 2000;
for (const it of todo) {
    const key = `${it.job}/${it.name}`;
    for (let attempt = 0; ; attempt++) {
        let res;
        try { res = await fetch(it.url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(60000) }); }
        catch (e) { console.log(`${key}: ${e.message}`); await sleep(30000); continue; }
        if (res.status === 429 || res.status === 503) {
            const wait = Math.max(60, parseInt(res.headers.get('retry-after') || '600', 10)) * 1000;
            console.log(`${new Date().toISOString().slice(11, 19)} ${key}: ${res.status}, waiting ${wait / 1000}s`);
            gap = Math.min(gap * 2, 15000);
            await sleep(wait + 5000);
            continue;
        }
        if (res.status === 404) { status[key] = 'notfound'; console.log(`${key}: 404`); break; }
        if (!res.ok) { status[key] = `http-${res.status}`; console.log(`${key}: ${res.status}`); break; }
        const text = await res.text();
        if (!/<svg[\s>]/.test(text)) { status[key] = 'not-svg'; break; }
        fs.mkdirSync(path.join(OUT, it.job), { recursive: true });
        fs.writeFileSync(path.join(OUT, it.job, `${it.name}.svg`), text);
        status[key] = 'ok';
        console.log(`${new Date().toISOString().slice(11, 19)} ${key}: ok`);
        break;
    }
    save();
    await sleep(gap);
}
const counts = Object.values(status).reduce((a, s) => ((a[s] = (a[s] || 0) + 1), a), {});
console.log('done', JSON.stringify(counts));
