/**
 * apply-aliases.js — makes every exchange ticker resolve to the right logo.
 *
 * WHY: the pipeline stores logos by ticker with special characters stripped (M&M -> MM) and keeps NSE and BSE
 * tickers in one folder, and companies get renamed (Zomato -> Eternal). The result was a placeholder badge under
 * the ticker people actually use (M&M, ARE&M, ZOMATO ...) while the real logo sat under another name.
 *
 * HOW: curated/aliases.json maps  "<MARKET>:<TICKER USED BY THE EXCHANGE OR OLD TICKER>" -> { logoOf: "<TICKER THAT HAS THE REAL LOGO>" }.
 * This script copies the real logo to the alias filename (overwriting a placeholder). It never overwrites a real logo of
 * the alias, never copies a procedural badge, and is safe to run repeatedly.
 * A file that exists under the alias name but whose manifest entry has NO company details (no logoid) is treated as an
 * unverified leftover of the old pipeline (e.g. M&MFIN.png was a 1200x630 banner): the canonical logo replaces it. sync.js runs it first, so a placeholder that a
 * later crawl creates is repaired on the next sync.
 *
 *   node scripts/apply-aliases.js            apply and print a summary
 *   node scripts/apply-aliases.js --check    change nothing; exit 1 if any alias is out of date
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isProcedural } from './svg-quality.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LOGOS_DIR = path.join(REPO_ROOT, 'logos');
export const ALIASES_PATH = path.join(REPO_ROOT, 'curated', 'aliases.json');

export function loadAliases() {
    try { return JSON.parse(fs.readFileSync(ALIASES_PATH, 'utf-8')); } catch (e) { return {}; }
}

const findLogo = (dir, sym) => {
    for (const ext of ['svg', 'png']) {
        const p = path.join(dir, `${sym}.${ext}`);
        if (fs.existsSync(p)) return { path: p, ext };
    }
    return null;
};
const isPlaceholder = (file) => file.ext === 'png' ? false : isProcedural(fs.readFileSync(file.path, 'utf-8').slice(0, 1500));

const manifestCache = {};
const loadManifest = (market) => {
    if (!(market in manifestCache)) {
        try { manifestCache[market] = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifests', `${market}.json`), 'utf-8')); } catch (e) { manifestCache[market] = {}; }
    }
    return manifestCache[market];
};

export function applyAliases({ check = false } = {}) {
    const aliases = loadAliases();
    const res = { applied: 0, upToDate: 0, skippedRealLogo: 0, skippedNoCanonical: 0, details: [] };
    for (const [key, a] of Object.entries(aliases)) {
        const [market, alias] = [key.split(':')[0].toLowerCase(), key.split(':').slice(1).join(':')];
        const dir = path.join(LOGOS_DIR, market);
        if (!fs.existsSync(dir)) continue;
        const canon = findLogo(dir, a.logoOf);
        if (!canon || isPlaceholder(canon)) { res.skippedNoCanonical++; continue; }
        const own = findLogo(dir, alias);
        const mf = loadManifest(market);
        // the alias file exists but nobody ever recorded which company it is, while the canonical logo has full details
        const hasNoDetails = !!own && !(mf[alias] && mf[alias].logoid) && !!(mf[a.logoOf] && mf[a.logoOf].logoid);
        if (own && !isPlaceholder(own) && !hasNoDetails) {
            // the alias already has a real logo: leave it, unless it is byte-identical (then it is simply up to date)
            if (fs.readFileSync(own.path).equals(fs.readFileSync(canon.path))) res.upToDate++; else res.skippedRealLogo++;
            continue;
        }
        const dest = path.join(dir, `${alias}.${canon.ext}`);
        res.applied++; res.details.push(`${key} <- ${a.logoOf}`);
        if (check) continue;
        if (own && own.path !== dest) fs.rmSync(own.path, { force: true });     // drop the placeholder of the other format
        fs.copyFileSync(canon.path, dest);
    }
    return res;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const check = process.argv.includes('--check');
    const r = applyAliases({ check });
    console.log(`[aliases] ${check ? 'would apply' : 'applied'}: ${r.applied} | already up to date: ${r.upToDate} | alias has its own real logo (kept): ${r.skippedRealLogo} | canonical missing or a placeholder (skipped): ${r.skippedNoCanonical}`);
    if (r.applied && process.argv.includes('--verbose')) console.log(r.details.join('\n'));
    if (check && r.applied) process.exit(1);
}
