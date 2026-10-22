/**
 * logo-tool.js — Check, clean and preview one logo SVG; look up a listed company.
 *
 *   node scripts/logo-tool.js check <file.svg> [--fix]     # rules every logo must pass; --fix cleans in place
 *   node scripts/logo-tool.js preview <file.svg> <out.png> [size]   # render on white and dark tiles to look at
 *   node scripts/logo-tool.js find <MARKET:TICKER | name words>     # is the company in the catalogue?
 *
 * Rules: well-formed XML, a viewBox, real vector art (no embedded raster, no blank tile), no scripts,
 * event handlers or external links, unique ids (namespaced), at most 300 KB after cleaning.
 * --fix optimises with svgo when installed (npm i --no-save svgo), adds a viewBox from width/height and namespaces ids.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { namespaceIds, idsNamespaced } from './svg-quality.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 300 * 1024;

export function problemsOf(svg) {
    const p = [];
    if (!/<svg[\s>]/.test(svg)) p.push('not an SVG');
    if (/<script|<foreignObject|\son\w+\s*=|(?:xlink:)?href="(?:https?:)?\/\//i.test(svg)) p.push('active content or external link');
    if (/<image\b/i.test(svg) || /data:image\/(png|jpe?g|gif|webp)/i.test(svg)) p.push('embedded raster image (must be pure vector)');
    if (!/<svg[^>]*\bviewBox=/i.test(svg)) p.push('no viewBox');
    // One compound path is a valid logo here (hasVisibleArt expects a tile plus art, as in the TradingView icons).
    const body = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<defs[\s\S]*?<\/defs>/g, '');
    if (!/<(path|circle|ellipse|rect|polygon|polyline|text|line|use)\b/.test(body)) p.push('no visible art');
    if (!idsNamespaced(svg)) p.push('ids not namespaced');
    if (Buffer.byteLength(svg) > MAX_BYTES) p.push(`larger than ${MAX_BYTES / 1024} KB`);
    return p;
}

function xmlOk(file) {
    try { execFileSync('xmllint', ['--noout', file], { stdio: 'pipe' }); return true; } catch { return false; }
}

async function clean(svg) {
    try {
        const { optimize } = await import('svgo');
        svg = optimize(svg, {
            multipass: true,
            plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false, cleanupIds: { minify: false } } } }, 'removeDimensions'],
        }).data;
    } catch { /* svgo not installed: keep as is */ }
    if (!/<svg[^>]*\bviewBox=/i.test(svg)) {
        const w = svg.match(/<svg[^>]*\bwidth="([\d.]+)(?:px)?"/i)?.[1], h = svg.match(/<svg[^>]*\bheight="([\d.]+)(?:px)?"/i)?.[1];
        if (w && h) svg = svg.replace(/<svg\b/i, `<svg viewBox="0 0 ${w} ${h}"`);
    }
    svg = svg.replace(/<\?xml[^>]*\?>\s*/, '').replace(/<!DOCTYPE[^>]*>\s*/i, '').trim() + '\n';
    return idsNamespaced(svg) ? svg : namespaceIds(svg);
}

export function aspectOf(svg) {
    const vb = svg.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    return vb ? +(vb[1] / vb[2]).toFixed(3) : null;
}

const [cmd, a, b, c] = process.argv.slice(2);
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    if (cmd === 'check') {
        let svg = fs.readFileSync(a, 'utf-8');
        if (process.argv.includes('--fix')) { svg = await clean(svg); fs.writeFileSync(a, svg); }
        const p = problemsOf(svg);
        if (!xmlOk(a)) p.push('invalid XML');
        console.log(JSON.stringify({ file: a, ok: !p.length, problems: p, bytes: Buffer.byteLength(svg), aspect: aspectOf(svg) }));
        process.exit(p.length ? 1 : 0);
    } else if (cmd === 'preview') {
        const sharp = (await import('sharp')).default;
        const size = parseInt(c || '512', 10);
        const svg = fs.readFileSync(a);
        const art = await sharp(svg, { density: 600, limitInputPixels: false }).resize(size - 32, size - 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        const tile = (bg) => sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite([{ input: art, gravity: 'center' }]).png().toBuffer();
        const [light, dark] = await Promise.all([tile('#ffffff'), tile('#1f2937')]);
        await sharp({ create: { width: size * 2, height: size, channels: 4, background: '#ffffff' } })
            .composite([{ input: light, left: 0, top: 0 }, { input: dark, left: size, top: 0 }]).png().toFile(b);
        console.log(`Wrote ${b} (left: on white, right: on dark)`);
    } else if (cmd === 'find') {
        const q = [a, b, c].filter(Boolean).join(' ');
        const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'search-index.json'), 'utf-8'));
        let hits;
        if (/^[A-Z]+:[^\s]+$/i.test(q)) {
            const [m, t] = q.split(':');
            hits = index.filter((r) => r[2].toUpperCase() === m.toUpperCase() && r[0].toUpperCase() === t.toUpperCase());
        } else {
            const words = q.toLowerCase().split(/\s+/);
            hits = index.filter((r) => words.every((w) => `${r[0]} ${r[1]}`.toLowerCase().includes(w))).slice(0, 15);
        }
        for (const [t, name, m, fmt, , usd] of hits) {
            const file = `logos/${m.toLowerCase()}/${t}.${fmt}`;
            console.log(`${m}:${t}\t${name}\t${usd ? '$' + (usd / 1e9).toFixed(1) + 'B' : '-'}\t${file}`);
        }
        if (!hits.length) console.log('no match');
    } else {
        console.log('usage: logo-tool.js check <file.svg> [--fix] | preview <file.svg> <out.png> [size] | find <query>');
        process.exit(2);
    }
}
