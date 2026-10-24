#!/usr/bin/env node
/**
 * Weekly data-health report (markdown). Read-only; it never fails on stale data, it reports it.
 *
 *   node scripts/weekly-report.js [--days 7] [--today YYYY-MM-DD] [--out report.md]
 *
 * Sources: pipeline-status.json (last pipeline run, what remains), data-quality-report.json (validation errors and
 * warnings), quality-report.json (placeholders without a real logo), api/v1/index.json (counts, logo provenance) and
 * `freshness.marketData` of every company in manifests/*.json (market data older than --days, per market).
 * When $GITHUB_STEP_SUMMARY is set, the report is also appended there (the weekly-report workflow relies on it).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const DAYS = Number(opt('--days', 7));
const today = new Date(opt('--today', new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return null; } };
const age = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? null : Math.floor((today - t) / 864e5); };
const n = (x) => (x ?? 0).toLocaleString('en-US');

const pipeline = readJson('pipeline-status.json');
const dq = readJson('data-quality-report.json');
const q = readJson('quality-report.json');
const idx = readJson('api/v1/index.json');

// Market data age per market, from the manifests.
const perMarket = [];
let total = 0, stale = 0, missing = 0, oldest = null;
const dir = path.join(ROOT, 'manifests');
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort() : []) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    let t = 0, s = 0, none = 0, old = null;
    for (const r of Object.values(m)) {
        if (!r || typeof r !== 'object' || r.logoOf) continue;
        t++;
        const d = r.freshness?.marketData;
        if (!d) { none++; continue; }
        const a = age(d);
        if (a != null && a > DAYS) s++;
        if (!old || d < old) old = d;
    }
    total += t; stale += s; missing += none;
    if (old && (!oldest || old < oldest)) oldest = old;
    if (s || none) perMarket.push({ market: path.basename(f, '.json'), t, s, none, old });
}

const lines = [];
lines.push(`# Weekly data report, ${today.toISOString().slice(0, 10)}`, '');
const pAge = pipeline?.finishedAt ? age(pipeline.finishedAt) : null;
lines.push('## Summary', '', '| Check | Value |', '| :--- | ---: |');
if (idx) lines.push(`| Listings (api/v1/index.json) | ${n(idx.companies)} |`);
lines.push(`| Market data older than ${DAYS} days | ${n(stale)} of ${n(total)} (${total ? Math.round((stale / total) * 100) : 0}%) |`);
lines.push(`| Companies with no market-data date | ${n(missing)} |`);
lines.push(`| Oldest market-data date | ${oldest ?? 'n/a'} |`);
lines.push(`| Last pipeline run | ${pipeline?.finishedAt ? `${pipeline.finishedAt.slice(0, 10)} (${pAge} days ago)` : 'n/a'} |`);
lines.push(`| Placeholders without a real logo (quality-report.json) | ${q ? n(q.placeholdersWithoutRealLogo?.length) : 'n/a'} |`);
if (idx?.logoProvenance) lines.push(`| Generated logos in the API (\`logoProvenance.generated\`) | ${n(idx.logoProvenance.generated)} |`);
const errCount = dq ? Object.values(dq.errors || {}).reduce((a, v) => a + (Array.isArray(v) ? v.length : Number(v) || 0), 0) : null;
const warnCount = dq ? Object.values(dq.warnings || {}).reduce((a, v) => a + (Array.isArray(v) ? v.length : Number(v) || 0), 0) : null;
lines.push(`| Validation errors (data-quality-report.json) | ${errCount == null ? 'n/a' : n(errCount)} |`);
lines.push(`| Validation warnings | ${warnCount == null ? 'n/a' : n(warnCount)} |`, '');

const flags = [];
if (pipeline && !pipeline.complete) flags.push('The last pipeline run did not complete.');
if (pipeline?.failed) flags.push('The last pipeline run failed.');
if (pAge != null && pAge > 35) flags.push(`The monthly pipeline has not run for ${pAge} days.`);
if (stale) flags.push(`${n(stale)} companies have market data older than ${DAYS} days.`);
if (errCount) flags.push(`${n(errCount)} validation errors.`);
lines.push('## Needs attention', '', ...(flags.length ? flags.map((f) => `- ${f}`) : ['Nothing.']), '');

if (pipeline?.remaining) {
    lines.push('## Work remaining in the pipeline', '', '| Step | Remaining |', '| :--- | ---: |');
    for (const [k, v] of Object.entries(pipeline.remaining)) lines.push(`| ${k} | ${n(v)} |`);
    lines.push('');
}
if (dq) {
    const rows = [...Object.entries(dq.errors || {}).map(([k, v]) => ['error', k, v]), ...Object.entries(dq.warnings || {}).map(([k, v]) => ['warning', k, v])];
    lines.push('## Validation (data-quality-report.json)', '', `Checked ${dq.checkedAt ?? 'n/a'}; ${n(dq.enrichmentRecords)} enrichment records, ${n(dq.manifestEntries)} manifest entries (aliases included).`, '');
    lines.push(rows.length ? '| Kind | Check | Count |\n| :--- | :--- | ---: |\n' + rows.map(([a, b, c]) => `| ${a} | ${b} | ${n(Array.isArray(c) ? c.length : c)} |`).join('\n') : 'No errors or warnings recorded.', '');
}
if (perMarket.length) {
    perMarket.sort((a, b) => b.s + b.none - (a.s + a.none));
    lines.push(`## Markets with market data older than ${DAYS} days`, '', '| Market | Companies | Stale | No date | Oldest |', '| :--- | ---: | ---: | ---: | :--- |');
    for (const r of perMarket.slice(0, 25)) lines.push(`| ${r.market} | ${n(r.t)} | ${n(r.s)} | ${n(r.none)} | ${r.old ?? 'n/a'} |`);
    if (perMarket.length > 25) lines.push('', `...and ${perMarket.length - 25} more markets.`);
    lines.push('');
}
if (q?.placeholdersWithoutRealLogo?.length) {
    const byMarket = {};
    for (const f of q.placeholdersWithoutRealLogo) { const m = f.split('/')[1]; byMarket[m] = (byMarket[m] || 0) + 1; }
    lines.push('## Placeholders by market', '', Object.entries(byMarket).sort((a, b) => b[1] - a[1]).map(([m, c]) => `${m}: ${c}`).join(', '), '');
}

const md = lines.join('\n');
if (opt('--out')) fs.writeFileSync(opt('--out'), md);
else console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
