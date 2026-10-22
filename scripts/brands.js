/**
 * brands.js — The brand catalogue: consumer brands, sub-brands, products and subsidiaries of listed companies.
 *
 *   node scripts/brands.js            # check brands/brands.json and render the PNG sizes
 *   node scripts/brands.js --check    # check only (CI): no files written
 *
 * brands/brands.json is hand-curated (one record per brand, each with its listed parent and sources).
 * Logos live in brands/logos/<slug>.svg (full logo) and brands/logos/<slug>.mark.svg (optional square mark).
 * PNGs: brands/png/<size>/<slug>.png, rendered from the SVG (full logo, contained in a transparent square).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { problemsOf } from './logo-tool.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BRANDS_DIR = path.join(ROOT, 'brands');
export const BRAND_PNG_SIZES = [256, 512, 1024];
const REGISTRY = path.join(BRANDS_DIR, 'brands.json');

export const KINDS = ['brand', 'subsidiary', 'product', 'service', 'app'];
const SOURCE_TYPES = ['official-site', 'press-kit', 'wikimedia-commons', 'wikipedia'];

export function loadBrands() {
    return fs.existsSync(REGISTRY) ? JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')) : [];
}

/** Companies in the catalogue, as a Set of MARKET:TICKER. */
function catalogueKeys() {
    const keys = new Set();
    const dir = path.join(ROOT, 'manifests');
    for (const f of fs.readdirSync(dir)) {
        const m = f.replace('.json', '').toUpperCase();
        for (const t of Object.keys(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')))) keys.add(`${m}:${t}`);
    }
    return keys;
}

const urlRoot = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && `${x.protocol}//${x.hostname}` === u; } catch { return false; } };
const isUrl = (u) => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };

export function checkBrands(brands = loadBrands()) {
    const problems = [];
    const keys = catalogueKeys();
    const seen = new Set();
    for (const b of brands) {
        const at = `brand ${b.slug}`;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.slug || '')) problems.push(`${at}: slug must be lower-case kebab-case`);
        if (seen.has(b.slug)) problems.push(`${at}: duplicate slug`);
        seen.add(b.slug);
        if (!b.name) problems.push(`${at}: no name`);
        if (!keys.has(b.parent)) problems.push(`${at}: parent ${b.parent} is not in the catalogue`);
        for (const o of b.otherListedOwners || []) if (!keys.has(o)) problems.push(`${at}: other owner ${o} is not in the catalogue`);
        if (!KINDS.includes(b.kind)) problems.push(`${at}: kind must be one of ${KINDS.join(', ')}`);
        if (b.website != null && !urlRoot(b.website)) problems.push(`${at}: website must be scheme and host only`);
        if (b.brandColor != null && !/^#[0-9A-F]{6}$/.test(b.brandColor)) problems.push(`${at}: brandColor must be upper-case #RRGGBB`);
        if (b.wikidata != null && !/^Q\d+$/.test(b.wikidata)) problems.push(`${at}: bad wikidata id`);
        if (!isUrl(b.logoSource)) problems.push(`${at}: logoSource must be a URL`);
        if (!SOURCE_TYPES.includes(b.logoSourceType)) problems.push(`${at}: logoSourceType must be one of ${SOURCE_TYPES.join(', ')}`);
        for (const [field, rel] of [['logo', b.logo], ['mark', b.mark]]) {
            if (rel == null && field === 'mark') continue;
            const want = `brands/logos/${b.slug}${field === 'mark' ? '.mark' : ''}.svg`;
            if (rel !== want) { problems.push(`${at}: ${field} must be ${want}`); continue; }
            const fp = path.join(ROOT, rel);
            if (!fs.existsSync(fp)) { problems.push(`${at}: ${rel} is missing`); continue; }
            for (const p of problemsOf(fs.readFileSync(fp, 'utf-8'))) problems.push(`${rel}: ${p}`);
        }
    }
    // Every logo file belongs to a brand.
    const listed = new Set(brands.flatMap((b) => [b.logo, b.mark].filter(Boolean)));
    const logoDir = path.join(BRANDS_DIR, 'logos');
    if (fs.existsSync(logoDir)) for (const f of fs.readdirSync(logoDir)) if (!listed.has(`brands/logos/${f}`)) problems.push(`brands/logos/${f}: not in brands.json`);
    return problems;
}

async function renderPngs(brands) {
    const sharp = (await import('sharp')).default;
    const want = new Set();
    let i = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
        while (i < brands.length) {
            const b = brands[i++];
            const svg = fs.readFileSync(path.join(ROOT, b.logo));
            for (const size of BRAND_PNG_SIZES) {
                const out = path.join(BRANDS_DIR, 'png', String(size), `${b.slug}.png`);
                want.add(out);
                fs.mkdirSync(path.dirname(out), { recursive: true });
                const buf = await sharp(svg, { density: Math.min(2400, Math.max(72, size * 4)) })
                    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .png({ compressionLevel: 9, palette: true }).toBuffer();
                if (!fs.existsSync(out) || !buf.equals(fs.readFileSync(out))) fs.writeFileSync(out, buf);
            }
        }
    }));
    for (const size of BRAND_PNG_SIZES) {
        const dir = path.join(BRANDS_DIR, 'png', String(size));
        if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (!want.has(path.join(dir, f))) fs.rmSync(path.join(dir, f));
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const brands = loadBrands();
    const problems = checkBrands(brands);
    console.log(`Checked ${brands.length} brands; ${problems.length} problem(s).`);
    problems.slice(0, 50).forEach((p) => console.log(`  - ${p}`));
    if (problems.length) process.exit(1);
    if (!process.argv.includes('--check')) {
        await renderPngs(brands);
        console.log(`Rendered PNGs (${BRAND_PNG_SIZES.join(', ')} px) for ${brands.length} brands.`);
    }
}
