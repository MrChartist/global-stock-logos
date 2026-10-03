/**
 * quality.js — Audit and repair logo quality across the whole catalog.
 *
 *   node scripts/quality.js          # report only
 *   node scripts/quality.js --fix    # repair, then re-run sync.js to refresh manifests
 *
 * Repairs (--fix):
 *   1. Generated placeholder badges and low-res PNGs are replaced by the real vector logo (via logoid).
 *   2. Logos with only a blank tile are removed.
 *   3. Gradient/clip ids are namespaced so logos can be inlined together.
 * Report always lists: invalid XML, placeholders with no real logo available, PNGs still under 256px.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generateProceduralSvg } from './generator.js';
import { isProcedural, hasVisibleArt, namespaceIds, idsNamespaced, fetchRealSvg } from './svg-quality.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGOS = path.join(ROOT, 'logos');
const FIX = process.argv.includes('--fix');
const CHECK = process.argv.includes('--check');

if (CHECK) {
    // Offline gate for CI: no network, no changes. Fails on anything a contributor must fix.
    const { execFileSync: run } = await import('child_process');
    const markets = fs.readdirSync(LOGOS).filter((d) => fs.statSync(path.join(LOGOS, d)).isDirectory());
    const files = markets.flatMap((d) => fs.readdirSync(path.join(LOGOS, d)).filter((f) => f.endsWith('.svg')).map((f) => path.join(LOGOS, d, f)));
    const problems = [];
    for (const f of files) {
        const svg = fs.readFileSync(f, 'utf-8');
        const rel = path.relative(ROOT, f);
        if (/<script|<foreignObject|\son\w+\s*=|(?:xlink:)?href="(?:https?:)?\/\//i.test(svg)) problems.push(`${rel}: active content or external link`);
        if (!isProcedural(svg) && !hasVisibleArt(svg)) problems.push(`${rel}: empty logo`);
        if (!isProcedural(svg) && !idsNamespaced(svg)) problems.push(`${rel}: ids not unique (run npm run quality:fix)`);
    }
    for (let k = 0; k < files.length; k += 2000) {
        try { run('xmllint', ['--noout', ...files.slice(k, k + 2000)], { stdio: 'pipe' }); }
        catch (e) { for (const m of String(e.stderr).matchAll(/^(.+\.svg):\d+: parser error/gm)) problems.push(`${path.relative(ROOT, m[1])}: invalid XML`); }
    }
    console.log(`Checked ${files.length} SVG files; ${problems.length} problem(s).`);
    problems.slice(0, 50).forEach((p) => console.log(`  - ${p}`));
    process.exit(problems.length ? 1 : 0);
}

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'companies-metadata.json'), 'utf-8'));

const pngWidth = (f) => { const b = fs.readFileSync(f); return b.readUInt32BE(16); };
const dirs = fs.readdirSync(LOGOS).filter((d) => fs.statSync(path.join(LOGOS, d)).isDirectory());
const stats = { upgraded: 0, removedEmpty: 0, idsFixed: 0, noRealLogo: [], lowResPng: [], invalid: [] };

for (const mk of dirs) {
    const dir = path.join(LOGOS, mk);
    const jobs = [];
    for (const file of fs.readdirSync(dir)) {
        const fp = path.join(dir, file);
        const sym = file.replace(/\.(svg|png)$/, '');
        const logoid = meta[`${mk.toUpperCase()}:${sym}`]?.logoid;
        if (file.endsWith('.png')) {
            if (pngWidth(fp) < 256 && !fs.existsSync(fp.replace(/\.png$/, '.svg'))) jobs.push({ fp, sym, logoid, kind: 'png' });
        } else if (file.endsWith('.svg')) {
            const svg = fs.readFileSync(fp, 'utf-8');
            if (isProcedural(svg)) jobs.push({ fp, sym, logoid, kind: 'proc' });
            else if (!hasVisibleArt(svg)) jobs.push({ fp, sym, logoid, kind: 'empty' });
            else if (!idsNamespaced(svg)) jobs.push({ fp, svg, kind: 'ids' });
        }
    }
    let i = 0;
    await Promise.all(Array.from({ length: 24 }, async () => {
        while (i < jobs.length) {
            const j = jobs[i++];
            if (j.kind === 'ids') {
                if (FIX) { fs.writeFileSync(j.fp, namespaceIds(j.svg)); }
                stats.idsFixed++;
                continue;
            }
            const real = FIX || j.kind !== 'png' ? await fetchRealSvg(j.logoid) : null;
            const svgPath = j.fp.replace(/\.png$/, '.svg');
            if (real) {
                if (FIX) fs.writeFileSync(svgPath, real);
                stats.upgraded++;
            } else if (j.kind === 'empty') {
                if (FIX) fs.rmSync(j.fp);
                stats.removedEmpty++;
            } else if (j.kind === 'proc') stats.noRealLogo.push(j.fp);
            else stats.lowResPng.push(j.fp);
        }
    }));
}

// Root-level flat copies: refresh from the best market copy (real vector beats placeholder / low-res).
const ROOT_PRIORITY = ['us', 'in', ...dirs.filter((d) => d !== 'us' && d !== 'in')];
for (const file of fs.readdirSync(LOGOS).filter((f) => /\.(svg|png)$/.test(f))) {
    const fp = path.join(LOGOS, file);
    const sym = file.replace(/\.(svg|png)$/, '');
    const weak = file.endsWith('.png') ? pngWidth(fp) < 256 : isProcedural(fs.readFileSync(fp, 'utf-8'));
    if (!weak) continue;
    const src = ROOT_PRIORITY.map((d) => path.join(LOGOS, d, `${sym}.svg`))
        .find((p) => fs.existsSync(p) && !isProcedural(fs.readFileSync(p, 'utf-8')));
    if (src && FIX) fs.copyFileSync(src, path.join(LOGOS, `${sym}.svg`));
}

// Well-formedness check with xmllint, in chunks.
const all = dirs.flatMap((d) => fs.readdirSync(path.join(LOGOS, d)).filter((f) => f.endsWith('.svg')).map((f) => path.join(LOGOS, d, f)));
for (let k = 0; k < all.length; k += 2000) {
    try { execFileSync('xmllint', ['--noout', ...all.slice(k, k + 2000)], { stdio: 'pipe' }); }
    catch (e) {
        for (const m of String(e.stderr).matchAll(/^(.+\.svg):\d+: parser error/gm)) stats.invalid.push(m[1]);
    }
}
stats.invalid = [...new Set(stats.invalid)];
if (FIX) {
    // Only generated badges can be invalid; regenerate them with the escaping-safe generator.
    for (const f of [...stats.invalid]) {
        const sym = path.basename(f, '.svg');
        const company = meta[`${path.basename(path.dirname(f)).toUpperCase()}:${sym}`]?.company || sym;
        if (isProcedural(fs.readFileSync(f, 'utf-8').replace(/J&K/, 'JK'))) { fs.writeFileSync(f, generateProceduralSvg(sym, company)); stats.invalid.splice(stats.invalid.indexOf(f), 1); }
    }
}

console.log(JSON.stringify({
    mode: FIX ? 'fix' : 'report',
    upgradedToRealVector: stats.upgraded, removedEmpty: stats.removedEmpty, idsNamespaced: stats.idsFixed,
    placeholdersWithoutRealLogo: stats.noRealLogo.length, pngsStillUnder256px: stats.lowResPng.length,
    invalidXml: stats.invalid.length,
}, null, 2));
fs.writeFileSync(path.join(ROOT, 'quality-report.json'), JSON.stringify({
    placeholdersWithoutRealLogo: stats.noRealLogo.map((f) => path.relative(ROOT, f)),
    pngsStillUnder256px: stats.lowResPng.map((f) => path.relative(ROOT, f)),
    invalidXml: stats.invalid.map((f) => path.relative(ROOT, f)),
}, null, 2));
