/**
 * sync.js — Global Stock Logos Manifest Indexer
 * Indexes logos across all international markets:
 * - India (NSE / BSE): logos/in/
 * - United States (NASDAQ / NYSE / S&P 500): logos/us/
 * - Unified flat root: logos/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { US_KNOWN_DOMAINS } from './domains-us.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGOS_DIR = path.join(REPO_ROOT, 'logos');
const IN_DIR = path.join(LOGOS_DIR, 'in');
const US_DIR = path.join(LOGOS_DIR, 'us');
const MANIFEST_PATH = path.join(REPO_ROOT, 'logos-manifest.json');

export function syncGlobalCatalog(repoName = 'MrChartist/global-stock-logos') {
    console.log('[sync] 🌐 Scanning Global Logo Assets...');

    let existing = { logos: {} };
    if (fs.existsSync(MANIFEST_PATH)) {
        try {
            existing = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
            if (!existing.logos) existing.logos = {};
        } catch (e) {}
    }

    const METADATA_PATH = path.join(REPO_ROOT, 'companies-metadata.json');
    let companyMeta = {};
    if (fs.existsSync(METADATA_PATH)) {
        try { companyMeta = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8')); } catch (e) {}
    }

    const logos = {};
    let inCount = 0;
    let usCount = 0;
    let svgs = 0;
    let pngs = 0;

    // 1. Index India (logos/in/)
    if (fs.existsSync(IN_DIR)) {
        const inFiles = fs.readdirSync(IN_DIR).filter(f => f.endsWith('.svg') || f.endsWith('.png'));
        for (const file of inFiles) {
            const ext = path.extname(file).replace('.', '').toLowerCase();
            const sym = path.basename(file, '.' + ext).toUpperCase();
            const stats = fs.statSync(path.join(IN_DIR, file));
            if (ext === 'svg') svgs++; else pngs++;
            inCount++;

            const prev = existing.logos[sym] || existing.logos[`IN:${sym}`] || {};
            const meta = companyMeta[`IN:${sym}`] || companyMeta[sym] || {};
            const item = {
                symbol: sym,
                company: meta.company || prev.company || sym,
                market: 'IN',
                country: 'India',
                exchanges: ['NSE', 'BSE'],
                format: ext,
                sector: meta.sector || prev.sector || null,
                industry: meta.industry || prev.industry || null,
                marketCap: meta.marketCap || prev.marketCap || null,
                logoid: meta.logoid || prev.logoid || null,
                path: `logos/in/${file}`,
                cdnMarketUrl: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos/in/${file}`,
                cdnDirectUrl: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos/${file}`,
                sizeBytes: stats.size,
                isProcedural: prev.isProcedural ?? (ext === 'svg' && stats.size < 2500),
                updatedAt: prev.updatedAt || new Date().toISOString()
            };
            logos[`IN:${sym}`] = item;
            if (!logos[sym]) logos[sym] = item; // default alias
        }
    }

    // 2. Index US (logos/us/)
    if (fs.existsSync(US_DIR)) {
        const usFiles = fs.readdirSync(US_DIR).filter(f => f.endsWith('.svg') || f.endsWith('.png'));
        for (const file of usFiles) {
            const ext = path.extname(file).replace('.', '').toLowerCase();
            const sym = path.basename(file, '.' + ext).toUpperCase();
            const stats = fs.statSync(path.join(US_DIR, file));
            if (ext === 'svg') svgs++; else pngs++;
            usCount++;

            const usMeta = US_KNOWN_DOMAINS[sym] || {};
            const prev = existing.logos[sym] || existing.logos[`US:${sym}`] || {};
            const meta = companyMeta[`US:${sym}`] || companyMeta[sym] || {};
            const item = {
                symbol: sym,
                company: meta.company || usMeta.name || prev.company || sym,
                market: 'US',
                country: 'United States',
                exchanges: ['NASDAQ', 'NYSE'],
                format: ext,
                sector: meta.sector || prev.sector || null,
                industry: meta.industry || prev.industry || null,
                marketCap: meta.marketCap || prev.marketCap || null,
                logoid: meta.logoid || prev.logoid || null,
                path: `logos/us/${file}`,
                cdnMarketUrl: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos/us/${file}`,
                cdnDirectUrl: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos/${file}`,
                sizeBytes: stats.size,
                isProcedural: prev.isProcedural ?? (ext === 'svg' && stats.size < 2500),
                updatedAt: prev.updatedAt || new Date().toISOString()
            };
            logos[`US:${sym}`] = item;
            if (!logos[sym]) logos[sym] = item; // alias if no collision
        }
    }

    const manifest = {
        name: "Global Stock Logos Catalog (India, US & World)",
        version: "2.0.0",
        updatedAt: new Date().toISOString(),
        totalEquities: inCount + usCount,
        stats: {
            markets: {
                IN: inCount,
                US: usCount
            },
            formats: {
                svg: svgs,
                png: pngs
            }
        },
        cdnBase: `https://cdn.jsdelivr.net/gh/${repoName}@main/logos`,
        logos
    };

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    fs.writeFileSync(path.join(LOGOS_DIR, 'logos-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`[sync] ✅ Successfully indexed ${manifest.totalEquities} Global Equities:`);
    console.log(`  🇮🇳 India (NSE/BSE) : ${inCount}`);
    console.log(`  🇺🇸 United States   : ${usCount}`);
    console.log(`  🎨 Formats         : ${svgs} SVGs, ${pngs} PNGs`);
    return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    syncGlobalCatalog();
}
