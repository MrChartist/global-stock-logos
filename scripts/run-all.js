/**
 * run-all.js — The "auto finish" pipeline. One command that does everything, resumes where it stopped,
 * checks the result and says whether the data is complete.
 *
 *   node scripts/run-all.js [--max-minutes 300] [--max-age-days 30]
 *
 * Steps (in order): new logos -> logo quality -> market data -> Wikidata profiles -> registries (GLEIF, SEC)
 *                   -> brand colours -> PNG sizes -> manifests -> validation.
 * The slow enrichment steps are time-boxed and resumable: records already refreshed within --max-age-days are skipped,
 * so running again continues from where the last run stopped.
 * Writes pipeline-status.json. `complete: true` means nothing is left to refresh and all checks pass.
 * Exit code: 0 = complete, 2 = not complete yet (run again), 1 = a check failed.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ROOT, loadShard } from './enrich-store.js';
import { MARKETS } from './markets.js';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const budget = parseInt(opt('--max-minutes', '300'), 10);
const maxAge = parseInt(opt('--max-age-days', '30'), 10);
const t0 = Date.now();
const minutesLeft = () => Math.max(1, Math.floor(budget - (Date.now() - t0) / 60000));
const today = Date.parse(new Date().toISOString().slice(0, 10));
const stale = (d) => !d || (today - Date.parse(d)) / 864e5 >= maxAge;

const steps = [];
function run(name, script, extra = [], { fatal = true } = {}) {
    const start = Date.now();
    console.log(`\n=== ${name} ===`);
    const r = spawnSync('node', [script, ...extra], { cwd: ROOT, stdio: 'inherit' });
    const ok = r.status === 0;
    steps.push({ name, ok, seconds: Math.round((Date.now() - start) / 1000) });
    if (!ok && fatal) { finish(false, `step failed: ${name}`); }
    return ok;
}

/** How many records still need a refresh (0 for everything = complete). */
function remaining() {
    const out = { marketData: 0, wikidataProfile: 0, registryGleif: 0, brandColour: 0, total: 0 };
    for (const key of Object.keys(MARKETS)) {
        const shard = loadShard(key);
        for (const v of Object.values(shard)) {
            out.total++;
            if (stale(v.marketDataAt)) out.marketData++;
            if (stale(v.wikidataAt)) out.wikidataProfile++;
            if (v.isin && stale(v.gleifAt)) out.registryGleif++;
            if (v.brandColor === undefined) out.brandColour++;
        }
    }
    return out;
}

function finish(failed, note = '') {
    const left = remaining();
    const pending = left.marketData + left.wikidataProfile + left.registryGleif + left.brandColour;
    const complete = !failed && pending === 0;
    const status = {
        finishedAt: new Date().toISOString(), complete, failed, note, minutesUsed: Math.round((Date.now() - t0) / 60000),
        remaining: left, steps,
        next: complete ? 'Nothing to do until the next monthly run.' : failed ? 'Fix the failed step, then run again.' : 'Run again: the pipeline resumes where it stopped.',
    };
    fs.writeFileSync(path.join(ROOT, 'pipeline-status.json'), JSON.stringify(status, null, 2));
    console.log('\n' + JSON.stringify({ complete, failed, remaining: left, note }, null, 2));
    process.exit(failed ? 1 : complete ? 0 : 2);
}

run('New listings and logos', 'scripts/bulk-crawl.js', [], { fatal: false });
run('Logo quality repair', 'scripts/quality.js', ['--fix']);
run('Market data', 'scripts/refresh-metadata.js', [], { fatal: false });
run('Wikidata profiles', 'scripts/enrich-wikidata.js', ['--max-age-days', String(maxAge), '--max-minutes', String(Math.max(1, Math.floor(minutesLeft() * 0.6)))], { fatal: false });
run('GLEIF / SEC registries', 'scripts/enrich-registries.js', ['--max-age-days', String(maxAge), '--max-minutes', String(Math.max(1, minutesLeft() - 15))], { fatal: false });
run('Brand colours', 'scripts/brand-color.js');
run('PNG sizes', 'scripts/render-png.js', ['--top', '3000']);
run('Manifests', 'scripts/sync.js');
run('Fix invalid values', 'scripts/validate-data.js', ['--fix']);
run('Manifests (after fixes)', 'scripts/sync.js');
run('Logo check', 'scripts/quality.js', ['--check']);
const valid = run('Data validation', 'scripts/validate-data.js', [], { fatal: false });
finish(!valid, valid ? '' : 'data validation failed');
