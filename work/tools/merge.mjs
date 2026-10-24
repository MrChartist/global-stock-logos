// One-off: merge agent outputs (.work/out/<job>/) into brands/brands.json and curated/overrides.json.
// Usage: node .work/merge.mjs [--write]
import fs from 'fs';
import path from 'path';
import { problemsOf } from '../scripts/logo-tool.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, '.work', 'out');
const WRITE = process.argv.includes('--write');
const read = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (e) { if (fs.existsSync(p)) console.log(`! cannot parse ${path.relative(ROOT, p)}: ${e.message}`); return d; } };

const keys = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'manifests'))) {
    const m = f.replace('.json', '').toUpperCase();
    for (const t of Object.keys(read(path.join(ROOT, 'manifests', f), {}))) keys.add(`${m}:${t}`);
}
const siteRoot = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? `${x.protocol}//${x.hostname.toLowerCase()}` : null; } catch { return null; } };
const isUrl = (u) => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };
// SVG rules, or for an official raster: a PNG of at least 1,000 px on its long side.
const fileProblems = (rel) => {
    const fp = path.join(ROOT, rel);
    if (rel.endsWith('.svg')) return problemsOf(fs.readFileSync(fp, 'utf-8'));
    const b = fs.readFileSync(fp);
    if (b.toString('ascii', 1, 4) !== 'PNG') return ['not a PNG'];
    return Math.max(b.readUInt32BE(16), b.readUInt32BE(20)) < 1000 ? ['raster below 1000 px'] : [];
};
const jobs = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((d) => fs.statSync(path.join(OUT, d)).isDirectory()).filter((d) => !(process.env.SKIP_JOBS || '').split(',').includes(d)).sort() : [];   // SKIP_JOBS=a,b leaves unreviewed jobs out
const report = { brands: {}, rejectedBrands: [], profiles: {}, rejectedFields: [], conflicts: [], corrections: [] };

// ---- brands
const brands = new Map();
const SOURCE_TYPES = { 'official-site': 'official-site', 'official-website': 'official-site', 'press-kit': 'press-kit', 'official-document': 'official-document', 'annual-report': 'official-document', 'wikimedia-commons': 'wikimedia-commons', commons: 'wikimedia-commons', wikipedia: 'wikipedia' };
// Facts with a source (brands and institutions): only a value whose source URL is given is kept.
const year = (v) => (Number.isInteger(v) && v >= 1600 && v <= 2026 ? v : null);
function facts(x, fields) {
    const out = {}, src = {};
    const aliases = [...new Set((x.aliases || []).filter((a) => typeof a === 'string' && a.trim() && a !== x.name))];
    if (aliases.length) out.aliases = aliases;
    for (const f of fields) {
        const v = f === 'founded' ? year(x[f]) : f === 'country' ? (/^[A-Z]{2}$/.test(x[f] || '') ? x[f] : null) : (typeof x[f] === 'string' && x[f].trim() ? x[f].trim() : null);
        const u = x.factSources?.[f];
        if (v != null && isUrl(u)) { out[f] = v; src[f] = u; }
    }
    if (Object.keys(src).length) out.factSources = src;
    return out;
}
function applyFacts(prev, u, fields, changed) {
    const f = facts(u, fields);
    if (f.aliases) { const add = f.aliases.filter((a) => !(prev.aliases || []).includes(a) && a !== prev.name); if (add.length) { prev.aliases = [...(prev.aliases || []), ...add]; changed.push('aliases'); } }
    for (const k of fields) if (f[k] != null && prev[k] == null) { prev[k] = f[k]; prev.factSources = { ...(prev.factSources || {}), [k]: f.factSources[k] }; changed.push(k); }
}
for (const job of jobs) {
    const list = read(path.join(OUT, job, 'brands.json'), []);
    report.brands[job] = 0;
    for (const b of Array.isArray(list) ? list : []) {
        const why = [];
        const slug = String(b.slug || '').toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) why.push('bad slug');
        if (!keys.has(b.parent)) why.push(`parent ${b.parent} not in catalogue`);
        const logo = [`brands/logos/${slug}.svg`, `brands/logos/${slug}.png`].find((x) => fs.existsSync(path.join(ROOT, x))) || `brands/logos/${slug}.svg`;
        const lp = path.join(ROOT, logo);
        if (!fs.existsSync(lp)) why.push('logo file missing');
        else { const p = fileProblems(logo); if (p.length) why.push(`logo: ${p.join('; ')}`); }
        const st = SOURCE_TYPES[b.logoSourceType];
        if (!st) why.push(`logoSourceType ${b.logoSourceType}`);
        if (!isUrl(b.logoSource)) why.push('logoSource not a URL');
        if (why.length) { report.rejectedBrands.push({ job, slug, why }); continue; }
        const markPath = [`brands/logos/${slug}.mark.svg`, `brands/logos/${slug}.mark.png`].find((x) => fs.existsSync(path.join(ROOT, x)));
        const hasMark = !!markPath && !fileProblems(markPath).length;
        const rec = {
            slug, name: b.name, parent: b.parent,
            otherListedOwners: [...new Set((b.otherListedOwners || []).filter((o) => keys.has(o) && o !== b.parent))],
            kind: ['brand', 'subsidiary', 'product', 'service', 'app'].includes(b.kind) ? b.kind : 'brand',
            category: b.category || null, description: b.description || null,
            website: b.website ? siteRoot(b.website) : null,
            wikidata: /^Q\d+$/.test(b.wikidata || '') ? b.wikidata : null,
            brandColor: /^#[0-9A-Fa-f]{6}$/.test(b.brandColor || '') ? b.brandColor.toUpperCase() : null,
            logo, mark: hasMark ? markPath : null, onDark: !!b.onDark,
            logoSource: b.logoSource, logoSourceType: st,
            ownershipSource: isUrl(b.ownershipSource) ? b.ownershipSource : null,
            checkedAt: b.checkedAt || '2026-10-22',
            ...facts(b, ['founded', 'country']),
        };
        if (brands.has(slug)) {
            const prev = brands.get(slug);
            if (prev.parent !== rec.parent) report.conflicts.push({ slug, a: prev.parent, b: rec.parent, job });
            prev.otherListedOwners = [...new Set([...prev.otherListedOwners, ...rec.otherListedOwners, ...(prev.parent !== rec.parent ? [rec.parent] : [])])];
            continue;
        }
        brands.set(slug, rec);
        report.brands[job]++;
    }
}
// Updates to brands that already exist: fill missing details and add listed owners; never touch logo or parent.
report.brandUpdates = [];
for (const job of jobs) {
    const upd = read(path.join(OUT, job, 'brand-updates.json'), {});
    for (const [slug, u] of Object.entries(upd || {})) {
        const prev = brands.get(slug);
        if (!prev) { report.brandUpdates.push({ job, slug, skipped: 'no such brand' }); continue; }
        if (u.parent && u.parent !== prev.parent) report.conflicts.push({ slug, a: prev.parent, b: u.parent, job });
        const changed = [];
        const owners = (u.otherListedOwners || []).filter((o) => keys.has(o) && o !== prev.parent && !prev.otherListedOwners.includes(o));
        if (owners.length) { prev.otherListedOwners.push(...owners); changed.push('otherListedOwners'); }
        const fill = {
            category: u.category, description: u.description, website: u.website && siteRoot(u.website),
            wikidata: /^Q\d+$/.test(u.wikidata || '') ? u.wikidata : null,
            brandColor: /^#[0-9A-Fa-f]{6}$/.test(u.brandColor || '') ? u.brandColor.toUpperCase() : null,
            ownershipSource: isUrl(u.ownershipSource) ? u.ownershipSource : null,
        };
        for (const [k, v] of Object.entries(fill)) if (v && !prev[k]) { prev[k] = v; changed.push(k); }
        applyFacts(prev, u, ['founded', 'country'], changed);
        report.brandUpdates.push({ job, slug, changed });
    }
}
// Orphan logo files (written but not recorded)
const logoDir = path.join(ROOT, 'brands', 'logos');
const brandOrphans = fs.existsSync(logoDir) ? fs.readdirSync(logoDir).filter((f) => !brands.has(f.replace(/(\.mark)?\.(svg|png)$/, ''))) : [];

// ---- institutions (regulators, government, market infrastructure): .work/out/<job>/institutions.json
const institutions = new Map();
const rejectedInst = [];
for (const job of jobs) {
    for (const x of read(path.join(OUT, job, 'institutions.json'), []) || []) {
        const slug = String(x.slug || '').toLowerCase();
        if (!x.logo || !fs.existsSync(path.join(ROOT, x.logo))) { rejectedInst.push({ job, slug, why: 'logo missing' }); continue; }
        if (institutions.has(slug)) { rejectedInst.push({ job, slug, why: 'duplicate slug' }); continue; }
        const markOk = x.mark && fs.existsSync(path.join(ROOT, x.mark));
        // A logo shared with another institution (CBDT uses the Income Tax Department's) gets its own copy.
        const own = (rel, suffix) => {
            const want = `institutions/logos/${slug}${suffix}${path.extname(rel)}`;
            if (rel !== want && process.argv.includes('--write')) fs.copyFileSync(path.join(ROOT, rel), path.join(ROOT, want));
            return want;
        };
        x.logo = own(x.logo, '');
        if (markOk) x.mark = own(x.mark, '.mark');
        institutions.set(slug, {
            slug, name: x.name, shortName: x.shortName || null, kind: x.kind, country: x.country || 'IN',
            parent: x.parent || null, listedAs: x.listedAs || null, description: x.description || null,
            website: x.website ? siteRoot(x.website) : null, wikidata: /^Q\d+$/.test(x.wikidata || '') ? x.wikidata : null,
            brandColor: /^#[0-9A-Fa-f]{6}$/.test(x.brandColor || '') ? x.brandColor.toUpperCase() : null,
            logo: x.logo, mark: markOk ? x.mark : null, onDark: !!x.onDark,
            logoSource: x.logoSource, logoSourceType: SOURCE_TYPES[x.logoSourceType] || x.logoSourceType, usageNote: x.usageNote || null, checkedAt: x.checkedAt || '2026-10-23',
            ...facts(x, ['founded', 'headquarters', 'legalBasis']),
        });
    }
}
// Updates to institutions that already exist: fill missing facts, never touch the logo.
report.institutionUpdates = [];
for (const job of jobs) {
    for (const [slug, u] of Object.entries(read(path.join(OUT, job, 'institution-updates.json'), {}) || {})) {
        const prev = institutions.get(slug);
        if (!prev) { report.institutionUpdates.push({ job, slug, skipped: 'no such institution' }); continue; }
        const changed = [];
        for (const k of ['description', 'wikidata', 'website']) {
            const v = k === 'website' ? u.website && siteRoot(u.website) : k === 'wikidata' ? (/^Q\d+$/.test(u.wikidata || '') ? u.wikidata : null) : u[k];
            if (v && !prev[k]) { prev[k] = v; changed.push(k); }
        }
        applyFacts(prev, u, ['founded', 'headquarters', 'legalBasis'], changed);
        report.institutionUpdates.push({ job, slug, changed });
    }
}
// A parent that did not make it into the collection (no usable logo) is dropped.
for (const x of institutions.values()) if (x.parent && !institutions.has(x.parent) && !keys.has(x.parent)) x.parent = null;

// ---- profiles
const FIELDS = ['website', 'founded', 'headquarters', 'ceo', 'chairman', 'employees', 'slogan', 'wikidata'];
const overrides = read(path.join(ROOT, 'curated', 'overrides.json'), {});
const added = {};
for (const job of jobs) {
    const obj = read(path.join(OUT, job, 'profiles.json'), {});
    report.profiles[job] = 0;
    for (const [key, p] of Object.entries(obj || {})) {
        if (!keys.has(key)) { report.rejectedFields.push({ job, key, why: 'not in catalogue' }); continue; }
        const src = p._sources || p.sources || {};
        for (const f of FIELDS) {
            let v = p[f];
            if (v == null || v === '') continue;
            if (!isUrl(src[f])) { report.rejectedFields.push({ job, key, f, why: 'no source URL' }); continue; }
            if (f === 'website') v = siteRoot(v);
            if (f === 'founded' || f === 'employees') v = Number.isInteger(+v) ? +v : null;
            if (f === 'founded' && (v < 1000 || v > 2026)) v = null;
            if (f === 'wikidata' && !/^Q\d+$/.test(v)) v = null;
            if (typeof v === 'string') v = v.replace(/\s+/g, ' ').trim().replace(/^(Mr|Mrs|Ms|Dr|Shri|Smt)\.?\s+/i, '');
            if (v == null || v === '') { report.rejectedFields.push({ job, key, f, why: 'invalid value' }); continue; }
            const cur = (added[key] ||= {});
            if (cur[f] !== undefined && cur[f] !== v) { report.conflicts.push({ key, f, a: cur[f], b: v, job }); continue; }
            cur[f] = v;
            (cur.sources ||= {})[f] = src[f];
        }
        if (p._corrects) report.corrections.push({ key, job, was: p._corrects, now: Object.fromEntries(Object.keys(p._corrects).map((f) => [f, p[f]])) });
        report.profiles[job]++;
    }
}
for (const [key, rec] of Object.entries(added)) {
    const o = (overrides[key] ||= {});
    for (const [f, v] of Object.entries(rec)) {
        if (f === 'sources') o.sources = { ...(o.sources || {}), ...v };
        else if (o[f] === undefined) o[f] = v; else if (o[f] !== v) report.conflicts.push({ key, f, existing: o[f], proposed: v });
    }
}

// ---- logos (main replacements, HD logos, wrong PNGs)
const { execFileSync } = await import('child_process');
const { generateProceduralSvg } = await import('../scripts/generator.js');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf-8' });
const logoRecs = jobs.flatMap((job) => (read(path.join(OUT, job, 'logos.json'), []) || []).map((r) => ({ ...r, job })));
const recorded = new Set(logoRecs.filter((r) => r.kind !== 'remove-wrong').map((r) => r.file));
const BANNED = new Set(['logos-hd/in/MAHLIFE.svg']);   // rejected by a verifier; another job may have re-added it
const logoPlan = { mainNew: [], hd: [], deletePng: [], placeholder: [], orphanNew: [], restoreTracked: [], badFiles: [] };
for (const r of logoRecs) {
    if (r.kind === 'remove-wrong-svg') {   // a main SVG that is another organisation's logo, with no correct vector available
        if (r.file && fs.existsSync(path.join(ROOT, r.file)) && !logoRecs.some((x) => x.kind === 'main' && x.file === r.file)) (logoPlan.wrongSvg ||= []).push(r);
        continue;
    }
    if (r.kind === 'remove-wrong') {
        const png = r.png || r.file;
        if (fs.existsSync(path.join(ROOT, png))) { logoPlan.deletePng.push(png); if (!fs.existsSync(path.join(ROOT, png.replace(/\.png$/, '.svg')))) logoPlan.placeholder.push(r.key); }
        continue;
    }
    const fp = path.join(ROOT, r.file || '');
    if (!r.file || !fs.existsSync(fp) || BANNED.has(r.file)) continue;
    const p = fileProblems(r.file);
    if (p.length) { logoPlan.badFiles.push(`${r.file}: ${p.join('; ')}`); continue; }
    if (r.kind === 'main') {
        logoPlan.mainNew.push(r.file);
        const png = r.file.replace(/\.svg$/, '.png');
        if (fs.existsSync(path.join(ROOT, png))) logoPlan.deletePng.push(png);
    } else logoPlan.hd.push(r.file);
}
// Files the agents wrote but nobody recorded (or a verifier rejected): leave them out.
const status = git('status', '--porcelain', '--untracked-files=all', '--', 'logos', 'logos-hd').split('\n').filter(Boolean);
for (const line of status) {
    const st = line.slice(0, 2), f = line.slice(3);
    if (!/\.(svg|png)$/.test(f) || /^logos\/[a-z]+\/[^/]+\.png$/.test(f) && !recorded.has(f)) continue;
    if (recorded.has(f) && !BANNED.has(f) && !logoPlan.badFiles.some((b) => b.startsWith(f))) continue;
    if (st === '??') logoPlan.orphanNew.push(f); else if (st.includes('M')) logoPlan.restoreTracked.push(f);
}
logoPlan.deletePng = [...new Set(logoPlan.deletePng)];

console.log(JSON.stringify({
    mainLogos: logoPlan.mainNew.length, hdLogos: logoPlan.hd.length, pngsToDelete: logoPlan.deletePng.length,
    placeholders: logoPlan.placeholder, wrongSvgToBadge: (logoPlan.wrongSvg || []).map((r) => r.key), orphanLogoFiles: logoPlan.orphanNew, restoreTracked: logoPlan.restoreTracked, badFiles: logoPlan.badFiles,
}, null, 2));

console.log(JSON.stringify({ institutions: institutions.size, rejectedInstitutions: rejectedInst }, null, 2));
console.log(JSON.stringify({
    brands: brands.size, brandsByJob: report.brands, rejectedBrands: report.rejectedBrands.length, orphanLogos: brandOrphans,
    companiesWithFacts: Object.keys(added).length, facts: Object.values(added).reduce((n, r) => n + Object.keys(r).length - 1, 0),
    profilesByJob: report.profiles, rejectedFields: report.rejectedFields.length, conflicts: report.conflicts.length, corrections: report.corrections.length,
}, null, 2));
fs.writeFileSync(path.join(ROOT, '.work', 'merge-report.json'), JSON.stringify({ ...report, orphans: brandOrphans }, null, 2));
if (WRITE) {
    const sorted = [...brands.values()].sort((a, b) => a.slug.localeCompare(b.slug));
    fs.mkdirSync(path.join(ROOT, 'brands'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'brands', 'brands.json'), JSON.stringify(sorted, null, 1) + '\n');
    if (institutions.size) {
        fs.mkdirSync(path.join(ROOT, 'institutions'), { recursive: true });
        fs.writeFileSync(path.join(ROOT, 'institutions', 'institutions.json'), JSON.stringify([...institutions.values()].sort((a, b) => a.slug.localeCompare(b.slug)), null, 1) + '\n');
    }
    const ordered = Object.fromEntries(Object.keys(overrides).sort().map((k) => [k, overrides[k]]));
    fs.writeFileSync(path.join(ROOT, 'curated', 'overrides.json'), JSON.stringify(ordered, null, 1) + '\n');

    // Logos: park unrecorded/rejected files, restore tracked files nobody vouched for, delete superseded/wrong PNGs.
    const park = path.join(ROOT, '.work', 'parked');
    for (const f of new Set([...logoPlan.orphanNew, ...[...BANNED].filter((b) => fs.existsSync(path.join(ROOT, b)))])) {
        fs.mkdirSync(path.dirname(path.join(park, f)), { recursive: true });
        fs.renameSync(path.join(ROOT, f), path.join(park, f));
    }
    for (const f of logoPlan.restoreTracked) git('checkout', '--', f);
    for (const f of [...brandOrphans]) {
        fs.mkdirSync(path.join(park, 'brands', 'logos'), { recursive: true });
        fs.renameSync(path.join(logoDir, f), path.join(park, 'brands', 'logos', f));
    }
    const metaAll = read(path.join(ROOT, 'companies-metadata.json'), {});
    for (const png of logoPlan.deletePng) {
        if (git('ls-files', png).trim()) git('rm', '-q', png); else fs.rmSync(path.join(ROOT, png), { force: true });
    }
    for (const r of logoPlan.wrongSvg || []) {
        const [m, t] = r.key.split(':');
        fs.writeFileSync(path.join(ROOT, r.file), generateProceduralSvg(t, metaAll[r.key]?.company || t));
    }
    for (const key of logoPlan.placeholder) {
        const [m, t] = key.split(':');
        const svg = path.join(ROOT, 'logos', m.toLowerCase(), `${t}.svg`);
        if (!fs.existsSync(svg)) fs.writeFileSync(svg, generateProceduralSvg(t, metaAll[key]?.company || t));
    }
    // Flat root copies (logos/<TICKER>.*): US first, then India, as in quality.js.
    for (const f of [...logoPlan.mainNew, ...logoPlan.placeholder.map((k) => `logos/${k.split(':')[0].toLowerCase()}/${k.split(':')[1]}.svg`)]) {
        const [, mk, file] = f.split('/');
        if (!['us', 'in'].includes(mk)) continue;
        if (mk === 'in' && fs.existsSync(path.join(ROOT, 'logos', 'us', file))) continue;
        const sym = file.replace(/\.svg$/, '');
        const rootPng = path.join(ROOT, 'logos', `${sym}.png`), rootSvg = path.join(ROOT, 'logos', `${sym}.svg`);
        if (!fs.existsSync(rootPng) && !fs.existsSync(rootSvg)) continue;
        fs.copyFileSync(path.join(ROOT, f), rootSvg);
        if (fs.existsSync(rootPng)) { if (git('ls-files', `logos/${sym}.png`).trim()) git('rm', '-q', `logos/${sym}.png`); else fs.rmSync(rootPng); }
    }
    console.log('written');
}
