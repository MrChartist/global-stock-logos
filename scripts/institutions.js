/**
 * institutions.js — Market institutions: regulators, governments and ministries, central banks, exchanges,
 * depositories, clearing corporations, payment systems, rating agencies, industry bodies. Most are not listed companies.
 *
 *   node scripts/institutions.js            # check institutions/institutions.json and render the PNG sizes
 *   node scripts/institutions.js --check    # check only (CI): no files written
 *
 * institutions/institutions.json is hand-curated (one record per institution, with sources).
 * Logos: institutions/logos/<slug>.svg (official vector, preferred) or institutions/logos/<slug>.png when the
 * institution publishes no vector logo (official file only, at least 1,000 px on its long side, never upscaled);
 * optional square emblem/mark as <slug>.mark.svg|png.
 * PNGs: institutions/png/<size>/<slug>.png for 256, 512, 1024 and 2048 px (a raster original is only downscaled).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { problemsOf } from './logo-tool.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const INST_DIR = path.join(ROOT, 'institutions');
export const INST_PNG_SIZES = [256, 512, 1024, 2048];
const REGISTRY = path.join(INST_DIR, 'institutions.json');
export const MIN_RASTER = 1000;

export const INST_KINDS = ['government', 'ministry', 'regulator', 'central-bank', 'exchange', 'depository', 'clearing-corporation',
    'payment-system', 'rating-agency', 'credit-bureau', 'registrar', 'index-provider', 'industry-body', 'professional-body',
    'development-bank', 'public-programme', 'market-infrastructure'];
const SOURCE_TYPES = ['official-site', 'press-kit', 'official-document', 'wikimedia-commons', 'wikipedia'];

export const loadInstitutions = () => (fs.existsSync(REGISTRY) ? JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')) : []);

function catalogueKeys() {
    const keys = new Set();
    for (const f of fs.readdirSync(path.join(ROOT, 'manifests'))) {
        const m = f.replace('.json', '').toUpperCase();
        for (const t of Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests', f), 'utf-8')))) keys.add(`${m}:${t}`);
    }
    return keys;
}
const pngSize = (fp) => { const b = fs.readFileSync(fp); return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
const urlRoot = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && `${x.protocol}//${x.hostname}` === u; } catch { return false; } };
const isUrl = (u) => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };

export function checkInstitutions(list = loadInstitutions()) {
    const problems = [];
    const keys = catalogueKeys();
    const slugs = new Set(list.map((x) => x.slug));
    const seen = new Set();
    for (const x of list) {
        const at = `institution ${x.slug}`;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.slug || '')) problems.push(`${at}: slug must be lower-case kebab-case`);
        if (seen.has(x.slug)) problems.push(`${at}: duplicate slug`);
        seen.add(x.slug);
        if (!x.name) problems.push(`${at}: no name`);
        if (!/^[A-Z]{2}$/.test(x.country || '')) problems.push(`${at}: country must be an ISO 3166 alpha-2 code`);
        if (!INST_KINDS.includes(x.kind)) problems.push(`${at}: kind must be one of ${INST_KINDS.join(', ')}`);
        if (x.listedAs != null && !keys.has(x.listedAs)) problems.push(`${at}: listedAs ${x.listedAs} is not in the catalogue`);
        if (x.parent != null && !slugs.has(x.parent) && !keys.has(x.parent)) problems.push(`${at}: parent ${x.parent} is neither an institution slug nor a catalogue company`);
        if (x.website != null && !urlRoot(x.website)) problems.push(`${at}: website must be scheme and host only`);
        if (x.brandColor != null && !/^#[0-9A-F]{6}$/.test(x.brandColor)) problems.push(`${at}: brandColor must be upper-case #RRGGBB`);
        if (x.wikidata != null && !/^Q\d+$/.test(x.wikidata)) problems.push(`${at}: bad wikidata id`);
        if (!isUrl(x.logoSource)) problems.push(`${at}: logoSource must be a URL`);
        if (!SOURCE_TYPES.includes(x.logoSourceType)) problems.push(`${at}: logoSourceType must be one of ${SOURCE_TYPES.join(', ')}`);
        for (const field of ['logo', 'mark']) {
            const rel = x[field];
            if (rel == null && field === 'mark') continue;
            const want = new RegExp(`^institutions/logos/${x.slug}${field === 'mark' ? '\\.mark' : ''}\\.(svg|png)$`);
            if (!want.test(rel || '')) { problems.push(`${at}: ${field} must be institutions/logos/${x.slug}${field === 'mark' ? '.mark' : ''}.svg (or .png)`); continue; }
            const fp = path.join(ROOT, rel);
            if (!fs.existsSync(fp)) { problems.push(`${at}: ${rel} is missing`); continue; }
            if (rel.endsWith('.svg')) for (const p of problemsOf(fs.readFileSync(fp, 'utf-8'))) problems.push(`${rel}: ${p}`);
            else { const s = pngSize(fp); if (!s) problems.push(`${rel}: not a PNG`); else if (Math.max(...s) < MIN_RASTER) problems.push(`${rel}: raster logo is ${s.join('x')}, below ${MIN_RASTER} px`); }
        }
    }
    const listed = new Set(list.flatMap((x) => [x.logo, x.mark].filter(Boolean)));
    const dir = path.join(INST_DIR, 'logos');
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (!listed.has(`institutions/logos/${f}`)) problems.push(`institutions/logos/${f}: not in institutions.json`);
    return problems;
}

async function renderPngs(list) {
    const sharp = (await import('sharp')).default;
    const want = new Set();
    for (const x of list) {
        const src = fs.readFileSync(path.join(ROOT, x.logo));
        const isSvg = x.logo.endsWith('.svg');
        const native = isSvg ? Infinity : Math.max(...pngSize(path.join(ROOT, x.logo)));
        for (const size of INST_PNG_SIZES) {
            if (size > native) continue;   // never upscale a raster original
            const out = path.join(INST_DIR, 'png', String(size), `${x.slug}.png`);
            want.add(out);
            fs.mkdirSync(path.dirname(out), { recursive: true });
            const img = isSvg ? sharp(src, { density: Math.min(2400, Math.max(72, size * 4)), limitInputPixels: false }) : sharp(src, { limitInputPixels: false });
            const buf = await img.resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9, palette: isSvg }).toBuffer();
            if (!fs.existsSync(out) || !buf.equals(fs.readFileSync(out))) fs.writeFileSync(out, buf);
        }
    }
    for (const size of INST_PNG_SIZES) {
        const dir = path.join(INST_DIR, 'png', String(size));
        if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (!want.has(path.join(dir, f))) fs.rmSync(path.join(dir, f));
    }
}

/** PNG sizes that exist for an institution (raster originals are not upscaled). */
export function pngSizesOf(x) {
    if (x.logo.endsWith('.svg')) return INST_PNG_SIZES;
    const s = pngSize(path.join(ROOT, x.logo));
    return INST_PNG_SIZES.filter((n) => s && n <= Math.max(...s));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const list = loadInstitutions();
    const problems = checkInstitutions(list);
    console.log(`Checked ${list.length} institutions; ${problems.length} problem(s).`);
    problems.slice(0, 50).forEach((p) => console.log(`  - ${p}`));
    if (problems.length) process.exit(1);
    if (!process.argv.includes('--check')) {
        await renderPngs(list);
        console.log(`Rendered PNGs (${INST_PNG_SIZES.join(', ')} px) for ${list.length} institutions.`);
    }
}
