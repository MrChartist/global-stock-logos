#!/usr/bin/env node
/**
 * Pull-request guard for logo sources (CLAUDE.md: never TradingView, Clearbit, Brandfetch or logo aggregator sites).
 *
 *   node scripts/check-logo-sources.js [--base origin/main] [--head HEAD] [--body-file pr.md] [--no-svg-check]
 *
 * Looks at what the pull request adds (git diff base...head), and exits 1 if:
 *   - an added line in a source record names a forbidden source. The records are logo-sources.json,
 *     curated/logo-provenance.json, brands/brands.json, institutions/institutions.json and curated/overrides.json;
 *   - the pull request description (--body-file, or $PR_BODY) or a commit message links to a forbidden domain,
 *     or states a forbidden source ("Source: TradingView"), while logo files are added;
 *   - an added SVG names a forbidden domain in its text, or fails `node scripts/logo-tool.js check`.
 * Warns (exit 0) about added logo files with no recorded source: the daily sync adds crawled logos that way.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { problemsOf } from './logo-tool.js';

const ROOT = process.env.LOGO_GUARD_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Named in CLAUDE.md, plus common logo aggregator sites. Matched as a name or hostname, case-insensitive.
export const FORBIDDEN_NAMES = ['tradingview', 'clearbit', 'brandfetch'];
export const FORBIDDEN_HOSTS = ['logo.dev', 'seeklogo.com', 'worldvectorlogo.com', 'logowik.com', 'logoeps.net', 'logos-world.net', 'logos-download.com',
    'brandslogos.com', 'brandsoftheworld.com', 'vectorlogo.zone', '1000logos.net', 'freebiesupply.com', 'companieslogo.com', 'logopng.com', 'pngimg.com',
    'pnghut.com', 'cleanpng.com', 'pngwing.com', 'iconfinder.com', 'logodix.com', 'logotyp.us', 'logomaker.com', 'logoshape.com', 'stockanalysis.com', 'financialmodelingprep.com'];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NAME_RE = new RegExp(`(${FORBIDDEN_NAMES.join('|')})`, 'i');
const HOST_RE = new RegExp(`(?:^|[^a-z0-9-])((?:[a-z0-9-]+\\.)*(?:${FORBIDDEN_HOSTS.map(esc).join('|')}))(?![a-z0-9-])`, 'i');
const URL_RE = /https?:\/\/[^\s)"'<>\]]+/gi;
const SOURCE_RECORDS = ['logo-sources.json', 'curated/logo-provenance.json', 'brands/brands.json', 'institutions/institutions.json', 'curated/overrides.json'];
const LOGO_FILE = /^(logos|logos-hd|brands\/logos|institutions\/logos)\/.+\.(svg|png)$/i;

/** First forbidden source named in free text such as an added JSON line, or null. */
export function forbiddenIn(text) {
    return NAME_RE.exec(text)?.[1].toLowerCase() ?? HOST_RE.exec(text)?.[1].toLowerCase() ?? null;
}

/** For prose (PR body, commit messages): a link to a forbidden domain, or a "source: <forbidden>" statement. */
export function forbiddenInProse(text) {
    const hits = [];
    for (const line of text.split('\n')) {
        for (const u of line.match(URL_RE) || []) { const f = forbiddenIn(u); if (f) hits.push({ line: line.trim(), what: f }); }
        if (/\b(source|sourced|taken from|downloaded from|crawled from|via)\b/i.test(line) && !/\b(not|never|no|instead of|rather than|remove|removed|replace|replaced)\b/i.test(line)) {
            const f = forbiddenIn(line); if (f && !hits.some((h) => h.line === line.trim())) hits.push({ line: line.trim(), what: f });
        }
    }
    return hits;
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };

function resolveBase(arg) {
    for (const r of [arg, 'origin/main', 'main', 'HEAD~1']) if (r && tryGit('rev-parse', '--verify', '--quiet', r + '^{commit}') !== null) return r;
    throw new Error('no base ref found (use --base <ref>; in CI checkout with fetch-depth: 0)');
}

function main() {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
    const base = resolveBase(opt('--base'));
    const head = opt('--head', 'HEAD');
    const range = `${base}...${head}`;
    const errors = [];
    const warnings = [];

    const added = git('diff', '--name-only', '-z', '--diff-filter=AR', range).split('\0').filter((f) => LOGO_FILE.test(f));
    const changedRecords = SOURCE_RECORDS.filter((f) => git('diff', '--name-only', range, '--', f).trim());
    console.log(`check-logo-sources: ${range}: ${added.length} logo file(s) added, ${changedRecords.length} source record(s) changed`);

    // 1. Added lines of the source records.
    const addedRecordLines = [];
    for (const f of changedRecords) {
        for (const line of git('diff', '-U0', range, '--', f).split('\n')) {
            if (!line.startsWith('+') || line.startsWith('+++')) continue;
            addedRecordLines.push({ file: f, text: line.slice(1) });
            const hit = forbiddenIn(line);
            if (hit) errors.push(`${f}: added line names a forbidden source (${hit}): ${line.slice(1).trim().slice(0, 160)}`);
        }
    }

    if (added.length || changedRecords.length) {
        // 2. PR description and commit messages.
        const bodyFile = opt('--body-file');
        const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : process.env.PR_BODY || '';
        for (const h of forbiddenInProse(body)) errors.push(`pull request description names a forbidden source (${h.what}): ${h.line.slice(0, 160)}`);
        const log = git('log', '--format=%h%x00%B%x01', `${base}..${head}`).split('\x01').map((s) => s.trim()).filter(Boolean);
        for (const entry of log) {
            const [sha, msg] = entry.split('\0');
            for (const h of forbiddenInProse(msg || '')) errors.push(`commit ${sha}: message names a forbidden source (${h.what}): ${h.line.slice(0, 160)}`);
        }
    }

    // 3. Added files: forbidden names inside the file, and the logo rules.
    const svgs = added.filter((f) => /\.svg$/i.test(f));
    const noSvgCheck = args.includes('--no-svg-check');
    let checked = 0;
    for (const f of svgs) {
        const p = path.join(ROOT, f);
        if (!fs.existsSync(p)) continue;
        const svg = fs.readFileSync(p, 'utf8');
        const hit = forbiddenIn(svg);
        if (hit) errors.push(`${f}: file text names a forbidden source (${hit})`);
        if (noSvgCheck) continue;
        checked++;
        let problems;
        if (svgs.length <= 300) { // the same command a contributor runs
            const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/logo-tool.js'), 'check', p], { encoding: 'utf8', cwd: ROOT });
            problems = r.status === 0 ? [] : [(r.stdout + r.stderr).trim().split('\n').slice(0, 3).join(' / ')];
        } else problems = problemsOf(svg); // large crawls: same rules, in process
        if (problems.length) errors.push(`${f}: logo-tool check failed: ${problems.join('; ')}`);
    }

    // 4. Logos with no recorded source (warning only).
    const recorded = new Set(addedRecordLines.map((l) => l.text).join('\n').match(/[A-Za-z-]+\/[A-Za-z0-9_.&-]+\.svg|[A-Z]+:[A-Z0-9._&-]+/g) || []);
    const unsourced = added.filter((f) => {
        const m = f.match(/^logos\/([^/]+)\/(.+)\.(?:svg|png)$/i);
        return !(m && [...recorded].some((r) => r.toUpperCase().endsWith(':' + m[2].toUpperCase()) || r === f)) && !/^(brands|institutions)\//.test(f) && !changedRecords.some((r) => /brands|institutions/.test(r));
    });
    if (unsourced.length) warnings.push(`${unsourced.length} added logo file(s) have no source recorded in this change (logo-sources.json or curated/logo-provenance.json); they will be labelled "crawled". First: ${unsourced.slice(0, 3).join(', ')}`);

    for (const w of warnings) console.warn('warning: ' + w);
    if (errors.length) {
        console.error(`\n${errors.length} problem(s):\n` + errors.map((e) => '  - ' + e).join('\n') + '\n\nLogos must come from the owner\'s own site, an official document or Wikimedia Commons (CLAUDE.md).');
        process.exit(1);
    }
    console.log(`ok: no forbidden sources named; ${checked} SVG(s) passed logo-tool check`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
