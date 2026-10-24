/**
 * tier-report.js — How complete the data and logos are, by size tier, read from api/v1/.
 *
 *   node scripts/tier-report.js            tiers (top 500, top 3,000, all) and the weakest markets
 *   node scripts/tier-report.js --json     the same as JSON
 *
 * Run after build-api.js. Numbers in docs/ROADMAP.md come from here (npm run tiers).
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from './enrich-store.js';

const dir = path.join(ROOT, 'api', 'v1', 'companies');
const rows = [];
for (const mk of fs.readdirSync(dir)) {
    for (const f of fs.readdirSync(path.join(dir, mk))) rows.push(JSON.parse(fs.readFileSync(path.join(dir, mk, f), 'utf-8')));
}
rows.sort((a, b) => (b.marketCap?.usd || 0) - (a.marketCap?.usd || 0));

const FIELDS = {
    website: (r) => r.profile.website, founded: (r) => r.profile.founded, headquarters: (r) => r.profile.headquarters,
    employees: (r) => r.profile.employees, ceo: (r) => r.profile.ceo, 'ceo (checked)': (r) => r.profile.ceo?.confidence === 'high',
    chairman: (r) => r.profile.chairman, 'real logo': (r) => !r.logo.isPlaceholder, 'hd logo': (r) => r.logo.hd, 'png sizes': (r) => r.logo.png,
    'official or commons logo': (r) => ['official', 'commons'].includes(r.logo.provenance),
};
const pct = (set, fn) => Math.round((1000 * set.filter(fn).length) / set.length) / 10;
const report = (set) => ({ companies: set.length, ...Object.fromEntries(Object.entries(FIELDS).map(([k, fn]) => [k, pct(set, fn)])) });

const tiers = { 'top 500': report(rows.slice(0, 500)), 'top 3,000': report(rows.slice(0, 3000)), all: report(rows) };
const byMarket = {};
for (const r of rows) (byMarket[r.market] ||= []).push(r);
const weakest = Object.entries(byMarket).filter(([, v]) => v.length >= 200)
    .map(([market, v]) => ({ market, companies: v.length, website: pct(v, FIELDS.website), ceo: pct(v, FIELDS.ceo), 'real logo': pct(v, FIELDS['real logo']) }))
    .sort((a, b) => a.website - b.website).slice(0, 12);
const provenance = {};
for (const r of rows) provenance[r.logo.provenance] = (provenance[r.logo.provenance] || 0) + 1;

if (process.argv.includes('--json')) console.log(JSON.stringify({ tiers, weakest, provenance }, null, 2));
else {
    console.log('Percent of companies with each field, by tier'); console.table(tiers);
    console.log('Logo provenance (all files)', provenance);
    console.log('Markets with 200+ companies and the lowest website coverage'); console.table(weakest);
}
