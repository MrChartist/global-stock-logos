/**
 * extractor.js — Standalone Autonomous Logo Intake Engine
 * Multi-tier waterfall intake for Indian Stock Logos:
 * 1. Google Favicon V2 with high-res 128px request
 * 2. Direct corporate homepage scrape (apple-touch-icon, OpenGraph, SVG)
 * 3. Procedural Vector SVG Badge Generator (100% fallback guarantee)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KNOWN_DOMAINS, deduceDomainCandidates } from './domains.js';
import { generateProceduralSvg } from './generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGOS_DIR = path.resolve(__dirname, '..', 'logos');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Fetch and validate Google Favicon V2 icon
 */
async function fetchGoogleFavicon(domain) {
    if (!domain) return null;
    const url = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;

    try {
        const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(6000) });
        if (!res.ok) return null;

        const arrayBuffer = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);

        // Google returns a 726-byte default placeholder globe when no favicon is found
        if (buf.byteLength > 200 && buf.byteLength !== 726) {
            return { buffer: buf, format: 'png', source: 'google_favicon' };
        }
    } catch (e) {
        // timeout or network issue
    }
    return null;
}

/**
 * Direct website scrape for brand assets
 */
async function scrapeWebsiteBrandImage(domain) {
    if (!domain) return null;
    try {
        const siteUrl = `https://${domain}`;
        const res = await fetch(siteUrl, {
            headers: {
                'User-Agent': BROWSER_HEADERS['User-Agent'],
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) return null;

        const html = await res.text();

        // 1. Look for apple-touch-icon
        const appleMatch = html.match(/<link[^>]+rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["'][^>]+href=["']([^"']+)["']/i);
        // 2. Look for SVG icons
        const svgMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+\.svg)["']/i);
        // 3. Look for og:image
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

        const candidate = (svgMatch && svgMatch[1]) || (appleMatch && appleMatch[1]) || (ogMatch && ogMatch[1]);
        if (candidate) {
            let fullUrl = candidate.trim();
            if (fullUrl.startsWith('//')) fullUrl = `https:${fullUrl}`;
            else if (fullUrl.startsWith('/')) fullUrl = `https://${domain}${fullUrl}`;
            else if (!fullUrl.startsWith('http')) fullUrl = `https://${domain}/${fullUrl}`;

            const imgRes = await fetch(fullUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(5000) });
            if (imgRes.ok) {
                const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                if (imgBuf.byteLength > 400) {
                    const isSvg = fullUrl.endsWith('.svg') || (imgRes.headers.get('content-type') || '').includes('svg');
                    return {
                        buffer: imgBuf,
                        format: isSvg ? 'svg' : 'png',
                        source: 'website_scrape'
                    };
                }
            }
        }
    } catch (e) {
        // Skip scrape errors
    }
    return null;
}

/**
 * Ingest or generate logo for a symbol
 */
export async function ingestStockLogo(symbol, companyName = '', preferredDomain = null) {
    const sym = symbol.toUpperCase().trim();
    if (!sym) throw new Error('Symbol is required');

    fs.mkdirSync(LOGOS_DIR, { recursive: true });

    // Check existing disk assets
    const svgPath = path.join(LOGOS_DIR, `${sym}.svg`);
    const pngPath = path.join(LOGOS_DIR, `${sym}.png`);

    if (fs.existsSync(svgPath)) {
        return { symbol: sym, format: 'svg', path: `logos/${sym}.svg`, exists: true };
    }
    if (fs.existsSync(pngPath)) {
        return { symbol: sym, format: 'png', path: `logos/${sym}.png`, exists: true };
    }

    // Determine domain candidates
    const candidates = [];
    if (preferredDomain) candidates.push(preferredDomain);
    if (KNOWN_DOMAINS[sym]) candidates.push(KNOWN_DOMAINS[sym]);
    deduceDomainCandidates(sym, companyName).forEach(d => {
        if (!candidates.includes(d)) candidates.push(d);
    });

    console.log(`[extractor] Ingesting logo for ${sym}... Testing ${candidates.length} domain candidates`);

    // Priority 1: Google Favicon V2
    for (const domain of candidates) {
        const result = await fetchGoogleFavicon(domain);
        if (result) {
            const dest = path.join(LOGOS_DIR, `${sym}.png`);
            fs.writeFileSync(dest, result.buffer);
            console.log(`[extractor] ✅ ${sym}: Saved authentic logo via Google Favicon (${domain})`);
            return { symbol: sym, format: 'png', path: `logos/${sym}.png`, source: 'google_favicon' };
        }
    }

    // Priority 2: Direct Website Scrape
    for (const domain of candidates) {
        const result = await scrapeWebsiteBrandImage(domain);
        if (result) {
            const dest = path.join(LOGOS_DIR, `${sym}.${result.format}`);
            fs.writeFileSync(dest, result.buffer);
            console.log(`[extractor] ✅ ${sym}: Saved brand asset via website scrape (${domain})`);
            return { symbol: sym, format: result.format, path: `logos/${sym}.${result.format}`, source: 'website_scrape' };
        }
    }

    // Priority 3: Procedural Vector SVG Generator
    console.log(`[extractor] 🎨 ${sym}: Generating procedural vector SVG monogram badge`);
    const svgContent = generateProceduralSvg(sym, companyName);
    fs.writeFileSync(svgPath, svgContent, 'utf-8');
    return { symbol: sym, format: 'svg', path: `logos/${sym}.svg`, source: 'procedural_generator' };
}

// CLI Execution support
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const sym = process.argv[2] || 'TCS';
    const comp = process.argv[3] || '';
    ingestStockLogo(sym, comp).then(res => console.log('Result:', res)).catch(console.error);
}
