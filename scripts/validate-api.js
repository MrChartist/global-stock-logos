/**
 * validate-api.js — Check the built static API (api/v1/).
 *   - every company file validates against api/v1/schema/company.schema.json
 *   - every manifest company has a file, and the counts in index.json, markets.json and market lists agree
 *   - every ISIN shard (api/v1/isin/<prefix>.json) and exchange shard (api/v1/lookup/<EXCHANGE>.json) validates, stays under its size limit, lists every ISIN and exchange-ticker exactly once, and each line points at a company that carries it
 *   - brandInk meets WCAG AA (4.5:1) on every brandColor
 *   - all links in index.json are well-formed; the OpenAPI document is structurally sound
 * Exit code 1 on any problem.
 */
import fs from 'fs';
import path from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT } from './enrich-store.js';
import { contrast, MIN_CONTRAST } from './brand-ink.js';

const API = path.join(ROOT, 'api', 'v1');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'));
const problems = [];
const bad = (m) => problems.length < 60 && problems.push(m);

if (!fs.existsSync(API)) { console.error('api/v1 is missing: run node scripts/build-api.js'); process.exit(1); }
const index = read(path.join(API, 'index.json'));
const markets = read(path.join(API, 'markets.json'));
const ajv = new Ajv2020({ allErrors: false, strict: false });
addFormats(ajv);
const validate = ajv.compile(read(path.join(API, 'schema', 'company.schema.json')));

const checkInk = (where, color, ink) => {
    if (!color) { if (ink !== null) bad(`${where}: brandInk without a brandColor`); return; }
    if (!ink || !/^#[0-9A-F]{6}$/.test(ink.color) || !['light', 'dark'].includes(ink.theme)) { bad(`${where}: brandColor ${color} has no valid brandInk`); return; }
    const c = contrast(color, ink.color);
    if (c < MIN_CONTRAST) bad(`${where}: brandInk ${ink.color} on ${color} is ${c.toFixed(2)}:1, below ${MIN_CONTRAST}`);
    if (Math.abs(c - ink.contrast) > 0.01) bad(`${where}: brandInk.contrast ${ink.contrast} does not match ${c.toFixed(2)}`);
    if (ink.theme !== (ink.color === '#FFFFFF' ? 'dark' : 'light')) bad(`${where}: brandInk.theme ${ink.theme} does not fit ink ${ink.color}`);
};
const isinLines = new Map(), lookupKeys = new Set();
let companies = 0, invalid = 0;
for (const m of markets) {
    const list = read(path.join(API, 'markets', `${m.key}.json`));
    if (list.length !== m.companies) bad(`${m.key}: list has ${list.length} rows, markets.json says ${m.companies}`);
    const manifest = read(path.join(ROOT, 'manifests', `${m.key}.json`));
    const real = Object.values(manifest).filter((e) => !e.logoOf).length;
    if (real !== list.length) bad(`${m.key}: manifest has ${real} companies (aliases excluded), API list ${list.length}`);
    // every manifest entry, aliases included, must have a valid company file
    for (const ticker of Object.keys(manifest)) {
        const f = path.join(API, 'companies', m.key, `${ticker}.json`);
        if (!fs.existsSync(f)) { bad(`missing ${m.key}/${ticker}.json`); continue; }
        const c = read(f);
        companies++;
        if (!validate(c)) { invalid++; bad(`${m.key}/${ticker}: ${ajv.errorsText(validate.errors, { dataVar: '' })}`); }
        else if (c.ticker !== ticker || c.market !== m.code) bad(`${m.key}/${ticker}: ticker or market field mismatch`);
        else {
            checkInk(`${m.key}/${ticker}`, c.logo.brandColor, c.logo.brandInk);
            for (const role of ['ceo', 'chairman']) { const a = c.profile[role]?.asOf; if (a && (a > index.dataRefreshedAt || a < '2000-01-01')) bad(`${m.key}/${ticker}: ${role}.asOf ${a} is not a plausible check date`); }
            if (!manifest[ticker].logoOf) {
                if (c.isin) { const k = `${m.code}:${ticker}`; if (!isinLines.has(c.isin)) isinLines.set(c.isin, new Set()); isinLines.get(c.isin).add(k); }
                if (c.exchange) lookupKeys.add(`${c.exchange}-${ticker}`);
            }
        }
    }
}
if (index.companies + (index.aliases || 0) !== companies) bad(`index.json says ${index.companies} companies + ${index.aliases || 0} aliases, found ${companies} company files`);
if (index.markets !== markets.length) bad(`index.json says ${index.markets} markets, found ${markets.length}`);
for (const [k, u] of Object.entries(index.endpoints)) { try { new URL(u.replace(/\{[^}]+\}/g, 'x')); } catch { bad(`endpoint ${k} is not a valid URL: ${u}`); } }

const full = read(path.join(ROOT, 'search-index.json')), top = read(path.join(ROOT, 'search-index-top.json'));
if (full.length !== index.companies) bad(`search-index.json has ${full.length} rows, index.json says ${index.companies}`);
if (top.length !== Math.min(2000, full.length) || top.some((r, i) => r[0] !== full[i][0] || r[2] !== full[i][2])) bad('search-index-top.json is not the first rows of search-index.json');

// ISIN and exchange lookup shards: every shard validates, sits in the right place, stays under its size limit, and together they list every ISIN and
// exchange-ticker once, each line pointing at a company that carries it.
const fileList = (dir) => fs.readdirSync(path.join(API, dir)).filter((f) => f.endsWith('.json'));
const checkIsin = ajv.compile(read(path.join(API, 'schema', 'isin.schema.json')));
const checkLookup = ajv.compile(read(path.join(API, 'schema', 'lookup.schema.json')));
const companyOf = (market, ticker) => { const f = path.join(API, 'companies', market.toLowerCase(), `${ticker}.json`); return fs.existsSync(f) ? read(f) : null; };
const ISIN_SHARD_MAX = 500_000, LOOKUP_SHARD_MAX = 1_500_000;
const isinFiles = fileList('isin'), lookupFiles = fileList('lookup');
if (isinFiles.length > 1500 || isinFiles.length < 100) bad(`isin/: ${isinFiles.length} shards, expected a few hundred`);
const seenIsins = new Set();
for (const f of isinFiles) {
    const file = path.join(API, 'isin', f), prefix = f.replace('.json', ''), p = read(file);
    if (!checkIsin(p)) { bad(`isin/${f}: ${ajv.errorsText(checkIsin.errors, { dataVar: '' })}`); continue; }
    if (p.$split) {
        const subs = isinFiles.filter((x) => x.length === p.$split + 5 && x.startsWith(prefix));
        if (p.$split !== prefix.length + 1 || !subs.length) bad(`isin/${f}: $split ${p.$split} has no matching shards`);
        continue;
    }
    if (fs.statSync(file).size > ISIN_SHARD_MAX) bad(`isin/${f}: ${fs.statSync(file).size} bytes, over ${ISIN_SHARD_MAX}`);
    for (const [isin, e] of Object.entries(p)) {
        if (!isin.startsWith(prefix)) { bad(`isin/${f}: ${isin} does not belong in this shard`); continue; }
        if (seenIsins.has(isin)) bad(`isin/${f}: ${isin} is listed twice`);
        seenIsins.add(isin);
        const lines = [e.primary, ...e.others], keys = lines.map((l) => `${l[0]}:${l[1]}`), want = isinLines.get(isin);
        if (!want || lines.length !== want.size || keys.some((k) => !want.has(k)) || new Set(keys).size !== keys.length) bad(`isin/${f}: ${isin} lines do not match the companies that carry it`);
        if (e.primary[3] === 'D' && e.others.some((l) => l[3] === 'L')) bad(`isin/${f}: ${isin} primary is delisted but another line is listed`);
        for (const l of lines) { const c = companyOf(l[0], l[1]); if (!c || c.isin !== isin || c.exchange !== l[2] || c.market !== l[0] || (c.listing.status === 'listed') !== (l[3] === 'L')) bad(`isin/${f}: ${l[0]}/${l[1]} is not a matching company for ${isin}`); }
        if (lines[0] && e.name !== companyOf(e.primary[0], e.primary[1])?.name) bad(`isin/${f}: ${isin} name is not the primary's name`);
    }
}
if (seenIsins.size !== isinLines.size || index.isins !== isinLines.size) bad(`isin/: shards list ${seenIsins.size} ISINs, index.json says ${index.isins}, companies carry ${isinLines.size}`);
const seenKeys = new Set();
for (const f of lookupFiles) {
    const file = path.join(API, 'lookup', f), exchange = f.replace('.json', ''), p = read(file);
    if (!checkLookup(p)) { bad(`lookup/${f}: ${ajv.errorsText(checkLookup.errors, { dataVar: '' })}`); continue; }
    if (fs.statSync(file).size > LOOKUP_SHARD_MAX) bad(`lookup/${f}: over ${LOOKUP_SHARD_MAX} bytes, split it`);
    for (const [ticker, r] of Object.entries(p)) {
        const key = `${exchange}-${ticker}`, c = companyOf(r[0], ticker);
        if (!lookupKeys.has(key)) bad(`lookup/${f}: ${key} is not a company's exchange and ticker`);
        seenKeys.add(key);
        if (!c || c.exchange !== exchange || c.market !== r[0] || c.name !== r[1] || c.isin !== r[2] || (c.listing.status === 'listed') !== (r[3] === 'L')) bad(`lookup/${f}: ${key} does not match its company file`);
    }
}
if (seenKeys.size !== lookupKeys.size || index.lookups !== lookupKeys.size) bad(`lookup/: shards list ${seenKeys.size} keys, index.json says ${index.lookups}, companies give ${lookupKeys.size}`);

// Brands and institutions: every file validates, list = files, entities.json covers both, the guaranteed PNG sizes exist.
for (const [kind, dir, pngDir] of [['brand', 'brands', 'brands/png'], ['institution', 'institutions', 'institutions/png']]) {
    const check = ajv.compile(read(path.join(API, 'schema', `${kind}.schema.json`)));
    const list = read(path.join(API, `${dir}.json`));
    if (index[dir] !== list.length) bad(`index.json says ${index[dir]} ${dir}, ${dir}.json has ${list.length}`);
    for (const x of list) {
        const f = path.join(API, dir, `${x.slug}.json`);
        if (!fs.existsSync(f)) { bad(`missing ${dir}/${x.slug}.json`); continue; }
        const rec = read(f);
        if (!check(rec)) bad(`${dir}/${x.slug}: ${ajv.errorsText(check.errors, { dataVar: '' })}`);
        else checkInk(`${dir}/${x.slug}`, rec.brandColor, rec.brandInk);
        for (const size of [256, 512]) if (!fs.existsSync(path.join(ROOT, pngDir, String(size), `${x.slug}.png`))) bad(`${pngDir}/${size}/${x.slug}.png is missing (256 and 512 are promised for every ${kind})`);
    }
}
const entities = read(path.join(API, 'entities.json'));
if (entities.length !== index.brands + index.institutions) bad(`entities.json has ${entities.length} rows, expected ${index.brands + index.institutions}`);

const oa = read(path.join(API, 'openapi.json'));
if (!/^3\.1/.test(oa.openapi)) bad('openapi.json: version is not 3.1');
for (const [p, v] of Object.entries(oa.paths)) if (!v.get?.operationId || !v.get?.responses?.[200]) bad(`openapi.json: ${p} lacks operationId or a 200 response`);

console.log(`API check: ${companies} company files, ${markets.length} markets, ${invalid} schema failures, ${problems.length} problem(s).`);
problems.slice(0, 20).forEach((p) => console.log('  - ' + p));
process.exit(problems.length ? 1 : 0);
