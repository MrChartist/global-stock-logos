/**
 * render-png.js — PNG versions of the SVG logos in several sizes.
 *
 *   node scripts/render-png.js                       # pre-render the top 3000 companies by market cap
 *   node scripts/render-png.js --top 5000
 *   node scripts/render-png.js us AAPL 512 out.png   # one logo, any size, any ticker (on demand)
 *
 * Output: png/<size>/<market>/<TICKER>.png for sizes 64, 128, 256 and 512.
 * Files are re-rendered only when the SVG changes. Requires the dev dependency `sharp`.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { ROOT, loadShard, saveShard } from './enrich-store.js';

export const SIZES = [64, 128, 256, 512];
const render = (svg, size) => sharp(Buffer.from(svg), { density: Math.max(72, size * 6) })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true }).toBuffer();

const args = process.argv.slice(2);
if (args[0] && !args[0].startsWith('--')) {
    // On-demand: <market> <ticker> <size> [out]
    const [market, sym, size = '256', out] = args;
    const svg = fs.readFileSync(path.join(ROOT, 'logos', market.toLowerCase(), `${sym.toUpperCase()}.svg`), 'utf-8');
    const buf = await render(svg, parseInt(size, 10));
    const file = out || `${sym.toUpperCase()}-${size}.png`;
    fs.writeFileSync(file, buf);
    console.log(`Wrote ${file} (${buf.length} bytes)`);
    process.exit(0);
}

const top = parseInt(args.includes('--top') ? args[args.indexOf('--top') + 1] : '3000', 10);
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'companies-metadata.json'), 'utf-8'));
const ranked = Object.entries(meta)
    .filter(([, v]) => v.marketCap > 0)
    .sort((a, b) => b[1].marketCap - a[1].marketCap)
    .map(([k]) => k.split(':'))
    .filter(([m, s]) => fs.existsSync(path.join(ROOT, 'logos', m.toLowerCase(), `${s}.svg`)))
    .slice(0, top);

// Remove PNGs of companies that dropped out of the top list, so the folder stays bounded.
const keep = new Set(ranked.map(([m, s]) => `${m.toLowerCase()}/${s}`));
for (const size of SIZES) {
    const base = path.join(ROOT, 'png', String(size));
    if (!fs.existsSync(base)) continue;
    for (const m of fs.readdirSync(base)) for (const f of fs.readdirSync(path.join(base, m)))
        if (!keep.has(`${m}/${f.slice(0, -4)}`)) fs.rmSync(path.join(base, m, f));
}

const shards = {};
let rendered = 0, i = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < ranked.length) {
        const [M, sym] = ranked[i++];
        const m = M.toLowerCase();
        const shard = (shards[m] ||= loadShard(m));
        const svg = fs.readFileSync(path.join(ROOT, 'logos', m, `${sym}.svg`), 'utf-8');
        const hash = crypto.createHash('md5').update(svg).digest('hex').slice(0, 10);
        const rec = (shard[sym] ||= {});
        const allThere = SIZES.every((s) => fs.existsSync(path.join(ROOT, 'png', String(s), m, `${sym}.png`)));
        if (rec.pngHash === hash && allThere) continue;
        try {
            for (const s of SIZES) {
                const dir = path.join(ROOT, 'png', String(s), m);
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, `${sym}.png`), await render(svg, s));
            }
            rec.pngHash = hash; rec.pngSizes = SIZES; rendered++;
        } catch (e) { console.warn(`skip ${m}/${sym}: ${e.message}`); }
    }
}));
// Companies outside the top list have no PNGs: clear stale flags.
for (const m of fs.readdirSync(path.join(ROOT, 'enrichment')).map((f) => f.replace('.json', ''))) {
    const shard = (shards[m] ||= loadShard(m));
    for (const [sym, rec] of Object.entries(shard)) if (rec.pngSizes && !keep.has(`${m}/${sym}`)) { delete rec.pngSizes; delete rec.pngHash; }
    saveShard(m, shard);
}
console.log(`Rendered ${rendered} companies (top ${ranked.length}); sizes ${SIZES.join(', ')}.`);
