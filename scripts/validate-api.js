/**
 * validate-api.js — Check the built static API (api/v1/).
 *   - every company file validates against api/v1/schema/company.schema.json
 *   - every manifest company has a file, and the counts in index.json, markets.json and market lists agree
 *   - all links in index.json are well-formed; the OpenAPI document is structurally sound
 * Exit code 1 on any problem.
 */
import fs from 'fs';
import path from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT } from './enrich-store.js';

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

let companies = 0, invalid = 0;
for (const m of markets) {
    const list = read(path.join(API, 'markets', `${m.key}.json`));
    if (list.length !== m.companies) bad(`${m.key}: list has ${list.length} rows, markets.json says ${m.companies}`);
    const manifest = read(path.join(ROOT, 'manifests', `${m.key}.json`));
    if (Object.keys(manifest).length !== list.length) bad(`${m.key}: manifest has ${Object.keys(manifest).length} companies, API list ${list.length}`);
    for (const row of list) {
        const f = path.join(API, 'companies', m.key, `${row.ticker}.json`);
        if (!fs.existsSync(f)) { bad(`missing ${m.key}/${row.ticker}.json`); continue; }
        const c = read(f);
        companies++;
        if (!validate(c)) { invalid++; bad(`${m.key}/${row.ticker}: ${ajv.errorsText(validate.errors, { dataVar: '' })}`); }
        else if (c.ticker !== row.ticker || c.market !== m.code) bad(`${m.key}/${row.ticker}: ticker or market field mismatch`);
    }
}
if (index.companies !== companies) bad(`index.json says ${index.companies} companies, found ${companies}`);
if (index.markets !== markets.length) bad(`index.json says ${index.markets} markets, found ${markets.length}`);
for (const [k, u] of Object.entries(index.endpoints)) { try { new URL(u.replace(/\{[^}]+\}/g, 'x')); } catch { bad(`endpoint ${k} is not a valid URL: ${u}`); } }

const oa = read(path.join(API, 'openapi.json'));
if (!/^3\.1/.test(oa.openapi)) bad('openapi.json: version is not 3.1');
for (const [p, v] of Object.entries(oa.paths)) if (!v.get?.operationId || !v.get?.responses?.[200]) bad(`openapi.json: ${p} lacks operationId or a 200 response`);

console.log(`API check: ${companies} company files, ${markets.length} markets, ${invalid} schema failures, ${problems.length} problem(s).`);
problems.slice(0, 20).forEach((p) => console.log('  - ' + p));
process.exit(problems.length ? 1 : 0);
