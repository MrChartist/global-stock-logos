/**
 * svg-quality.js — Shared quality rules for logo SVGs.
 * Used by bulk-crawl.js (reject bad downloads) and quality.js (audit / repair the catalog).
 */
import crypto from 'crypto';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Generated initials badge from generator.js (not a real company logo). */
export function isProcedural(svg) {
    return /id="grad-[^"]*"/.test(svg.slice(0, 800)) && /id="shadow-/.test(svg.slice(0, 1200));
}

/** True if the file draws something besides the flat tile background. */
export function hasVisibleArt(svg) {
    const body = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<defs[\s\S]*?<\/defs>/g, '');
    const shapes = body.match(/<(path|circle|ellipse|rect|polygon|polyline|image|text|line|use)\b/g) || [];
    return shapes.length > 1;
}

/** Prefix every id (and its references) so several logos can be inlined in one page without clashes. */
export function namespaceIds(svg) {
    const ids = [...new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))];
    if (!ids.length) return svg;
    const tag = crypto.createHash('md5').update(svg).digest('hex').slice(0, 6);
    let out = svg;
    for (const id of ids) {
        const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const next = `${id}-${tag}`;
        out = out
            .replace(new RegExp(`\\bid="${esc}"`, 'g'), `id="${next}"`)
            .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${next})`)
            .replace(new RegExp(`((?:xlink:)?href)="#${esc}"`, 'g'), `$1="#${next}"`);
    }
    return out;
}

/** True once namespaceIds has been applied (ids end in -xxxxxx). */
export function idsNamespaced(svg) {
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    return ids.every((i) => /-[0-9a-f]{6}$/.test(i));
}

/** Download the real vector logo for a TradingView logoid; returns cleaned SVG text or null. */
export async function fetchRealSvg(logoid) {
    if (!logoid) return null;
    for (const url of [
        `https://s3-symbol-logo.tradingview.com/${logoid}--big.svg`,
        `https://s3-symbol-logo.tradingview.com/${logoid}.svg`,
    ]) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
                if (res.status === 404) break;
                if (res.ok) {
                    const t = await res.text();
                    if (t.includes('<svg') && t.includes('</svg>') && hasVisibleArt(t)) return namespaceIds(t);
                    break;
                }
            } catch {}
            await new Promise((r) => setTimeout(r, 500));
        }
    }
    return null;
}
