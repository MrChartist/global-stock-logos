/**
 * stale-officers.js — List CEO and chairman values that need a re-check.
 *
 *   node scripts/stale-officers.js                  # hand-checked values (confidence high) last checked more than 12 months ago
 *   node scripts/stale-officers.js --undated        # also those with no check date (asOf null)
 *   node scripts/stale-officers.js --months 6       # another age limit
 *   node scripts/stale-officers.js --market in      # one market
 *   node scripts/stale-officers.js --json           # machine-readable output
 *
 * `asOf` comes from curated/overrides.json ("asOf": { "ceo": "YYYY-MM-DD" }) and is never invented, so a value with no date is
 * reported only with --undated. Only hand-checked values (a source URL) are listed: Wikidata and exchange values carry no check date by design.
 * Reads the built API (api/v1), so run `npm run sync && npm run api` first. Always exits 0 (it is a report, for the monthly job).
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from './enrich-store.js';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const months = Number(arg('--months') ?? 12);
const undated = process.argv.includes('--undated'), asJson = process.argv.includes('--json');
const only = arg('--market')?.toLowerCase();
if (!(months > 0)) { console.error('--months must be a positive number'); process.exit(2); }

const API = path.join(ROOT, 'api', 'v1');
if (!fs.existsSync(API)) { console.error('api/v1 is missing: run npm run sync && npm run api'); process.exit(2); }
const index = JSON.parse(fs.readFileSync(path.join(API, 'index.json'), 'utf-8'));
const now = new Date(`${index.dataRefreshedAt}T00:00:00Z`);   // the data's own date, so the report does not change with the clock
const cutoff = new Date(now); cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
const cutoffIso = cutoff.toISOString().slice(0, 10);

const rows = [];
let checked = 0, dated = 0;
for (const mk of fs.readdirSync(path.join(API, 'companies')).sort()) {
    if (only && mk !== only) continue;
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests', `${mk}.json`), 'utf-8'));
    for (const f of fs.readdirSync(path.join(API, 'companies', mk))) {
        const ticker = f.replace(/\.json$/, '');
        if (manifest[ticker]?.logoOf) continue;
        const c = JSON.parse(fs.readFileSync(path.join(API, 'companies', mk, f), 'utf-8'));
        for (const role of ['ceo', 'chairman']) {
            const p = c.profile[role];
            if (!p || p.confidence !== 'high') continue;
            checked++;
            if (p.asOf) dated++;
            const stale = p.asOf ? p.asOf < cutoffIso : undated;
            if (stale) rows.push({ company: `${c.market}:${ticker}`, name: c.name, role, person: p.name, asOf: p.asOf, source: p.source });
        }
    }
}
rows.sort((a, b) => (a.asOf || '').localeCompare(b.asOf || '') || a.company.localeCompare(b.company) || a.role.localeCompare(b.role));

if (asJson) { console.log(JSON.stringify({ asOf: index.dataRefreshedAt, olderThan: cutoffIso, handChecked: checked, dated, listed: rows.length, rows }, null, 2)); process.exit(0); }
console.log(`Hand-checked officers: ${checked}; with a check date: ${dated}; without: ${checked - dated}.`);
console.log(`${rows.length} ${undated ? 'undated or ' : ''}checked before ${cutoffIso} (${months} months before ${index.dataRefreshedAt}):`);
for (const r of rows.slice(0, 200)) console.log(`  ${r.asOf || 'no date  '}  ${r.company.padEnd(18)} ${r.role.padEnd(9)} ${r.person}  <${r.source}>`);
if (rows.length > 200) console.log(`  ... and ${rows.length - 200} more (use --json for all)`);
if (!undated && checked > dated) console.log(`Tip: ${checked - dated} hand-checked values have no check date; add "asOf" to their entry in curated/overrides.json after re-checking, or list them with --undated.`);
