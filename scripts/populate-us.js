/**
 * populate-us.js — US Stock Logos Crawler & Ingestion Engine
 * Ingests logos for top US equities (NASDAQ, NYSE, S&P 500)
 * Saves to:
 * - logos/us/<SYMBOL>.<ext>
 * - logos/<SYMBOL>.<ext> (flat mirror for direct access)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { US_KNOWN_DOMAINS } from './domains-us.js';
import { generateProceduralSvg } from './generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGOS_DIR = path.join(REPO_ROOT, 'logos');
const US_LOGOS_DIR = path.join(LOGOS_DIR, 'us');

fs.mkdirSync(LOGOS_DIR, { recursive: true });
fs.mkdirSync(US_LOGOS_DIR, { recursive: true });

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchGoogleFavicon(domain) {
    if (!domain) return null;
    const url = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
    try {
        const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(6000) });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > 200 && buf.byteLength !== 726) {
            return { buffer: buf, format: 'png' };
        }
    } catch (e) {
        // network / timeout
    }
    return null;
}

export async function populateUSLogos() {
    console.log('🚀 Starting US Stock Logos Intake (S&P 500 / NASDAQ / NYSE)...');
    const symbols = Object.keys(US_KNOWN_DOMAINS);
    console.log(`📋 Total US equities to process: ${symbols.length}`);

    let authenticCount = 0;
    let proceduralCount = 0;
    let skipped = 0;

    for (const sym of symbols) {
        const info = US_KNOWN_DOMAINS[sym];
        const cleanSym = sym.replace(/[^A-Za-z0-9_.-]/g, '');

        const targetSvg = path.join(US_LOGOS_DIR, `${cleanSym}.svg`);
        const targetPng = path.join(US_LOGOS_DIR, `${cleanSym}.png`);

        if (fs.existsSync(targetSvg) || fs.existsSync(targetPng)) {
            skipped++;
            continue;
        }

        // 1. Try Google Favicon V2
        const favicon = await fetchGoogleFavicon(info.domain);
        if (favicon) {
            fs.writeFileSync(targetPng, favicon.buffer);
            // Also copy to root logos/ if not taken by IN stock
            const rootPng = path.join(LOGOS_DIR, `${cleanSym}.png`);
            if (!fs.existsSync(rootPng) && !fs.existsSync(path.join(LOGOS_DIR, `${cleanSym}.svg`))) {
                fs.writeFileSync(rootPng, favicon.buffer);
            }
            console.log(`[us-logos] ✅ ${cleanSym}: Authentic brand logo saved (${info.domain})`);
            authenticCount++;
            continue;
        }

        // 2. Fallback: Procedural Vector SVG
        const svgBadge = generateProceduralSvg(cleanSym, info.name);
        fs.writeFileSync(targetSvg, svgBadge, 'utf-8');
        const rootSvg = path.join(LOGOS_DIR, `${cleanSym}.svg`);
        if (!fs.existsSync(rootSvg) && !fs.existsSync(path.join(LOGOS_DIR, `${cleanSym}.png`))) {
            fs.writeFileSync(rootSvg, svgBadge, 'utf-8');
        }
        console.log(`[us-logos] 🎨 ${cleanSym}: Generated procedural SVG badge`);
        proceduralCount++;

        // Brief delay between network requests to be polite
        await new Promise(r => setTimeout(r, 60));
    }

    console.log();
    console.log('════════════════════════════════════════════════════');
    console.log('  🇺🇸  US Stock Logos Intake Complete!');
    console.log('════════════════════════════════════════════════════');
    console.log(`  ✅ Authentic Logos Ingested : ${authenticCount}`);
    console.log(`  🎨 Procedural Vector Badges : ${proceduralCount}`);
    console.log(`  ⏩ Already Cached (Skipped) : ${skipped}`);
    console.log(`  📁 Total US Assets Stored   : ${fs.readdirSync(US_LOGOS_DIR).length}`);
    console.log('════════════════════════════════════════════════════');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    populateUSLogos().catch(console.error);
}
