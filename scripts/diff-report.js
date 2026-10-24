#!/usr/bin/env node
/**
 * Markdown report of what changed between two snapshots of the catalogue.
 *
 *   node scripts/diff-report.js <old> <new> [--limit 100] [--out report.md]
 *
 * <old> and <new> are each one of:
 *   - a git ref (HEAD~1, origin/main, a tag, a commit): read from `manifests/*.json` in that commit
 *   - a directory: a repo checkout or a `manifests/` folder (market files) or an `api/v1/` folder (company files)
 *   - one JSON file: a market manifest (ticker -> company) or a flat object keyed "MARKET:TICKER"
 *
 * Lists companies added, removed and renamed (new name, or the same ISIN under a new ticker), CEO and chairman
 * changes, and logo changes (different logo id, format, placeholder state, provenance and, for git refs, a
 * different file). Aliases (`logoOf`) are ignored: they are not companies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30 });
const person = (v) => (v && typeof v === 'object' ? v.name ?? null : v ?? null);

/** Reduce a manifest entry or an API company file to the fields the report compares. */
export function normalise(r) {
    if (r.profile || r.logo) { // API company file
        return { name: r.name ?? null, isin: r.isin ?? null, ceo: person(r.profile?.ceo), chairman: person(r.profile?.chairman),
            logo: { id: r.logo?.svg ?? null, format: r.logo?.file?.format ?? null, placeholder: !!r.logo?.isPlaceholder, provenance: r.logo?.provenance ?? null } };
    }
    return { name: r.company ?? r.name ?? null, isin: r.isin ?? null, ceo: person(r.ceo), chairman: person(r.chairman),
        logo: { id: r.logoid ?? null, format: r.format ?? null, placeholder: !!r.isProcedural, provenance: r.provenance ?? null } };
}

function fromMarketObjects(files) { // [[marketKey, object]]
    const out = new Map();
    for (const [market, obj] of files) for (const [t, r] of Object.entries(obj)) {
        if (!r || typeof r !== 'object' || r.logoOf) continue;
        out.set(`${market.toUpperCase()}:${t}`, normalise(r));
    }
    return out;
}

function loadGit(ref) {
    const names = git('ls-tree', '--name-only', ref, 'manifests/').split('\n').filter((n) => n.endsWith('.json'));
    if (!names.length) throw new Error(`no manifests/*.json in ${ref}`);
    const snap = fromMarketObjects(names.map((n) => [path.basename(n, '.json'), JSON.parse(git('show', `${ref}:${n}`))]));
    const files = new Map();
    for (const line of git('ls-tree', '-r', ref, '--', 'logos').split('\n')) {
        const m = line.match(/^\d+ blob (\w+)\t(logos\/([^/]+)\/(.+)\.(?:svg|png))$/);
        if (m) files.set(`${m[3].toUpperCase()}:${m[4]}`, m[1]);
    }
    for (const [k, v] of snap) v.logo.file = files.get(k) ?? null;
    return snap;
}

function loadPath(p) {
    const abs = path.resolve(p);
    const st = fs.statSync(abs);
    const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
    if (st.isFile()) {
        const o = readJson(abs);
        const first = Object.keys(o)[0] ?? '';
        if (first.includes(':')) return new Map(Object.entries(o).filter(([, r]) => !r.logoOf).map(([k, r]) => [k.toUpperCase(), normalise(r)]));
        return fromMarketObjects([[path.basename(abs, '.json'), o]]);
    }
    for (const rel of ['manifests', '.', 'api/v1/companies', 'companies']) {
        const dir = path.join(abs, rel);
        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        if (entries.some((e) => e.isFile() && e.name.endsWith('.json') && !/^(package|logos-manifest|search-index|companies-metadata)/.test(e.name)) && rel !== 'api/v1/companies' && rel !== 'companies') {
            return fromMarketObjects(entries.filter((e) => e.isFile() && e.name.endsWith('.json') && !/^(package|logos-manifest|search-index|companies-metadata|quality|pipeline|data-quality|fx|logo-sources|tsconfig)/.test(e.name)).map((e) => [path.basename(e.name, '.json'), readJson(path.join(dir, e.name))]));
        }
        const dirs = entries.filter((e) => e.isDirectory());
        if (dirs.length && dirs.some((d) => fs.readdirSync(path.join(dir, d.name)).some((f) => f.endsWith('.json')))) {
            const out = new Map();
            for (const d of dirs) for (const f of fs.readdirSync(path.join(dir, d.name))) {
                if (!f.endsWith('.json')) continue;
                const r = readJson(path.join(dir, d.name, f));
                if (r.logoOf) continue;
                out.set(`${d.name.toUpperCase()}:${path.basename(f, '.json')}`, normalise(r));
            }
            return out;
        }
    }
    throw new Error(`${p}: no manifests or API company files found`);
}

export function load(spec) {
    return fs.existsSync(spec) ? loadPath(spec) : loadGit(spec);
}

export function diff(a, b) {
    const d = { added: [], removed: [], renamed: [], tickerMoved: [], ceo: [], chairman: [], logo: [] };
    const isinOld = new Map();
    for (const [k, v] of a) if (!b.has(k) && v.isin) isinOld.set(v.isin, k);
    for (const [k, v] of b) {
        const o = a.get(k);
        if (!o) {
            const from = v.isin && isinOld.get(v.isin);
            if (from) { d.tickerMoved.push({ from, to: k, name: v.name }); isinOld.delete(v.isin); } else d.added.push({ key: k, name: v.name });
            continue;
        }
        if (o.name !== v.name) d.renamed.push({ key: k, from: o.name, to: v.name });
        if (o.ceo !== v.ceo) d.ceo.push({ key: k, name: v.name, from: o.ceo, to: v.ceo });
        if (o.chairman !== v.chairman) d.chairman.push({ key: k, name: v.name, from: o.chairman, to: v.chairman });
        const reasons = [];
        for (const f of ['id', 'format', 'placeholder', 'provenance']) if (o.logo[f] !== v.logo[f] && !(f === 'provenance' && (o.logo[f] == null || v.logo[f] == null))) reasons.push(`${f}: ${o.logo[f]} -> ${v.logo[f]}`);
        if (o.logo.file !== undefined && v.logo.file !== undefined && o.logo.file !== v.logo.file) reasons.push('file content changed');
        if (reasons.length) d.logo.push({ key: k, name: v.name, reasons });
    }
    for (const [k, v] of a) if (!b.has(k) && ![...d.tickerMoved].some((m) => m.from === k)) d.removed.push({ key: k, name: v.name });
    return d;
}

export function render(d, labels, sizes, limit = 100) {
    const cell = (s) => String(s ?? 'null').replace(/\|/g, '\\|');
    const table = (title, rows, head, row) => {
        let s = `## ${title} (${rows.length})\n\n`;
        if (!rows.length) return s + 'None.\n\n';
        s += `| ${head.join(' | ')} |\n| ${head.map(() => ':---').join(' | ')} |\n`;
        for (const r of rows.slice(0, limit)) s += `| ${row(r).map(cell).join(' | ')} |\n`;
        if (rows.length > limit) s += `\n...and ${rows.length - limit} more (raise with --limit).\n`;
        return s + '\n';
    };
    return `# Catalogue changes: ${labels[0]} to ${labels[1]}\n\n${sizes[0].toLocaleString('en-US')} companies before, ${sizes[1].toLocaleString('en-US')} after.\n\n`
        + `| Change | Count |\n| :--- | ---: |\n| Added | ${d.added.length} |\n| Removed | ${d.removed.length} |\n| Renamed | ${d.renamed.length} |\n| Ticker changed (same ISIN) | ${d.tickerMoved.length} |\n| CEO changed | ${d.ceo.length} |\n| Chairman changed | ${d.chairman.length} |\n| Logo changed | ${d.logo.length} |\n\n`
        + table('Added', d.added, ['Company', 'Name'], (r) => [r.key, r.name])
        + table('Removed', d.removed, ['Company', 'Name'], (r) => [r.key, r.name])
        + table('Renamed', d.renamed, ['Company', 'Old name', 'New name'], (r) => [r.key, r.from, r.to])
        + table('Ticker changed', d.tickerMoved, ['Old', 'New', 'Name'], (r) => [r.from, r.to, r.name])
        + table('CEO changes', d.ceo, ['Company', 'Name', 'Old', 'New'], (r) => [r.key, r.name, r.from, r.to])
        + table('Chairman changes', d.chairman, ['Company', 'Name', 'Old', 'New'], (r) => [r.key, r.name, r.from, r.to])
        + table('Logo changes', d.logo, ['Company', 'Name', 'What'], (r) => [r.key, r.name, r.reasons.join('; ')]);
}

function main() {
    const args = process.argv.slice(2);
    const opt = (n, def) => { const i = args.indexOf(n); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
    const limit = Number(opt('--limit', 100));
    const out = opt('--out', null);
    if (args.length !== 2) { console.error('usage: diff-report.js <old> <new> [--limit N] [--out file.md]\n  each side: git ref, directory (checkout, manifests/, api/v1/) or a JSON file'); process.exit(2); }
    const [a, b] = [load(args[0]), load(args[1])];
    const md = render(diff(a, b), args, [a.size, b.size], limit);
    if (out) fs.writeFileSync(out, md); else process.stdout.write(md);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
