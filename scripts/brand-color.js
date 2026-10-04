/**
 * brand-color.js — Derive a brand colour for every logo from the SVG itself (no network).
 *
 * Rule: if the logo tile has a coloured background (not one of TradingView's neutral tiles),
 * that colour is the brand colour. Otherwise the most frequent saturated fill in the artwork.
 * The value is an approximation taken from the logo file, not an official brand-guideline colour.
 * Recomputed only when the SVG file changes (hash stored in the shard).
 *
 *   node scripts/brand-color.js [--markets us,in]
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MARKETS } from './markets.js';
import { ROOT, loadShard, saveShard } from './enrich-store.js';

const args = process.argv.slice(2);
const keys = args.includes('--markets') ? args[args.indexOf('--markets') + 1].split(',') : Object.keys(MARKETS);

const NAMED = { white: '#ffffff', black: '#000000', red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00', orange: '#ffa500' };
function toHex(c) {
    c = String(c).trim().toLowerCase();
    if (NAMED[c]) return NAMED[c];
    let m = c.match(/^#([0-9a-f]{3})$/); if (m) return '#' + [...m[1]].map((x) => x + x).join('');
    m = c.match(/^#([0-9a-f]{6})/); if (m) return '#' + m[1];
    m = c.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)/); if (m) return '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('');
    return null;
}
const hsl = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    return { l, s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)) };
};
const isNeutral = (hex) => { const { l, s } = hsl(hex); return s < 0.2 || l < 0.15 || l > 0.85; };

function gradientFirstStop(svg, id) {
    const m = svg.match(new RegExp(`<(?:linear|radial)Gradient[^>]*id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</(?:linear|radial)Gradient>`));
    const st = m && m[1].match(/stop-color="([^"]+)"/);
    return st ? toHex(st[1]) : null;
}
function fillOf(svg, raw) {
    const g = raw.match(/^url\(#([^)]+)\)/);
    return g ? gradientFirstStop(svg, g[1]) : toHex(raw);
}

export function brandColor(svg) {
    const body = svg.replace(/<!--[\s\S]*?-->/g, '');
    const fills = [...body.matchAll(/<(?:path|rect|circle|ellipse|polygon)\b[^>]*?\bfill="([^"]+)"/g)].map((m) => m[1]);
    if (!fills.length) return null;
    const tile = fillOf(body, fills[0]);
    if (tile && !isNeutral(tile)) return { color: tile.toUpperCase(), source: 'logo-tile' };
    const count = new Map();
    for (const raw of fills.slice(1)) {
        const hex = fillOf(body, raw);
        if (!hex) continue;
        const { l, s } = hsl(hex);
        if (s < 0.25 || l > 0.9 || l < 0.08) continue; // skip greys, near-white, near-black
        count.set(hex, (count.get(hex) || 0) + 1);
    }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) return { color: top[0].toUpperCase(), source: 'logo-artwork' };
    // Neutral tile and no saturated artwork (black / white / grey logo): low-confidence fallback.
    return tile ? { color: tile.toUpperCase(), source: 'neutral-tile' } : null;
}

if (process.argv[1] && process.argv[1].endsWith('brand-color.js')) {
    for (const key of keys) {
        if (!MARKETS[key]) continue;
        const dir = path.join(ROOT, 'logos', key);
        if (!fs.existsSync(dir)) continue;
        const shard = loadShard(key);
        let done = 0;
        for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
            const sym = file.slice(0, -4);
            const svg = fs.readFileSync(path.join(dir, file), 'utf-8');
            const hash = crypto.createHash('md5').update(svg).digest('hex').slice(0, 10);
            const rec = (shard[sym] ||= {});
            if (rec.svgHash === hash && rec.brandColor !== undefined) continue;
            const r = brandColor(svg);
            rec.svgHash = hash; rec.brandColor = r?.color || null; rec.brandColorSource = r?.source || null;
            done++;
        }
        // Entries without an SVG (older PNG-only logos) have no artwork to read a colour from.
        const svgs = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)));
        for (const [sym, rec] of Object.entries(shard)) if (!svgs.has(sym) && rec.brandColor === undefined) rec.brandColor = null;
        saveShard(key, shard);
        console.log(`[${key}] colours computed for ${done}`);
    }
}
