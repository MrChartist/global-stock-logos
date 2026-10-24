/**
 * validate-api.js — Check the built static API (api/v1/).
 *   - every company file validates against api/v1/schema/company.schema.json
 *   - every manifest company has a file, and the counts in index.json, markets.json and market lists agree
 *   - every ISIN and exchange lookup pointer validates, points at an existing company with the same ISIN or exchange, and each ISIN lists every line once
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

// ISIN and exchange lookup pointers: one file per ISIN and per exchange-ticker, each validating and pointing at a matching company.
const fileList = (dir) => fs.readdirSync(path.join(API, dir)).filter((f) => f.endsWith('.json'));
const checkIsin = ajv.compile(read(path.join(API, 'schema', 'isin.schema.json')));
const checkLookup = ajv.compile(read(path.join(API, 'schema', 'lookup.schema.json')));
const isinFiles = fileList('isin'), lookupFiles = fileList('lookup');
if (isinFiles.length !== isinLines.size || index.isins !== isinLines.size) bad(`isin/: ${isinFiles.length} files, index.json says ${index.isins}, companies carry ${isinLines.size} ISINs`);
if (lookupFiles.length !== lookupKeys.size || index.lookups !== lookupKeys.size) bad(`lookup/: ${lookupFiles.length} files, index.json says ${index.lookups}, companies give ${lookupKeys.size} keys`);
const companyAt = (url) => { const m = /\/companies\/([^/]+)\/(.+)\.json$/.exec(url); return m && path.join(API, 'companies', m[1], decodeURIComponent(m[2]) + '.json'); };
for (const f of isinFiles) {
    const p = read(path.join(API, 'isin', f)), isin = f.replace('.json', '');
    if (!checkIsin(p)) { bad(`isin/${f}: ${ajv.errorsText(checkIsin.errors, { dataVar: '' })}`); continue; }
    if (p.isin !== isin) bad(`isin/${f}: isin field is ${p.isin}`);
    const lines = [p.primary, ...p.others], want = isinLines.get(isin);
    if (!want || lines.length !== want.size || lines.some((l) => !want.has(`${l.market}:${l.ticker}`)) || new Set(lines.map((l) => `${l.market}:${l.ticker}`)).size !== lines.length) bad(`isin/${f}: lines do not match the companies that carry this ISIN`);
    if (p.primary.status === 'delisted' && p.others.some((l) => l.status === 'listed')) bad(`isin/${f}: primary is delisted but another line is listed`);
    for (const l of lines) { const cf = companyAt(l.url); if (!cf || !fs.existsSync(cf) || read(cf).isin !== isin) bad(`isin/${f}: ${l.url} is not a company with ISIN ${isin}`); }
}
for (const f of lookupFiles) {
    const p = read(path.join(API, 'lookup', f)), key = f.replace('.json', '');
    if (!checkLookup(p)) { bad(`lookup/${f}: ${ajv.errorsText(checkLookup.errors, { dataVar: '' })}`); continue; }
    const cf = companyAt(p.url), c = cf && fs.existsSync(cf) ? read(cf) : null;
    if (p.key !== key || !lookupKeys.has(key)) bad(`lookup/${f}: key ${p.key} does not match the file`);
    else if (!c || `${c.exchange}-${c.ticker}` !== key || c.market !== p.market || c.isin !== p.isin) bad(`lookup/${f}: ${p.url} does not match`);
}

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
