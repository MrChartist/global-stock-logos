/**
 * audit.js — Image Quality & Integrity Auditor
 * Scans all logo assets in logos/ to ensure zero broken, corrupted, or placeholder images.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGOS_DIR = path.resolve(__dirname, '..', 'logos');

export function auditLogos() {
    console.log('[audit] 🔍 Auditing all assets across root and market subdirectories...');
    const subDirs = fs.readdirSync(LOGOS_DIR).filter(d => {
        try { return fs.statSync(path.join(LOGOS_DIR, d)).isDirectory(); } catch(e) { return false; }
    });
    const searchDirs = [LOGOS_DIR, ...subDirs.map(d => path.join(LOGOS_DIR, d))];

    let errors = 0;
    let warnings = 0;
    let valid = 0;

    for (const dir of searchDirs) {
        const relDir = path.relative(path.resolve(LOGOS_DIR, '..'), dir);
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg') || f.endsWith('.png'));

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);

        if (stats.size === 0) {
            console.error(`[audit] ❌ Empty file: ${file}`);
            errors++;
            continue;
        }

        if (file.endsWith('.png')) {
            if (stats.size === 726) {
                console.warn(`[audit] ⚠️ Google placeholder globe (726 bytes): ${file}`);
                warnings++;
                continue;
            }
            const buf = Buffer.alloc(12);
            const fd = fs.openSync(filePath, 'r');
            fs.readSync(fd, buf, 0, 12, 0);
            fs.closeSync(fd);
            
            // Check PNG (89 50 4E 47), JPEG (FF D8 FF), WebP (RIFF....WEBP), or ICO (00 00 01 00)
            const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
            const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
            const isWebP = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
            const isIco = buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00;

            if (!isPng && !isJpeg && !isWebP && !isIco) {
                console.error(`[audit] ❌ Corrupted/Unrecognized image binary: ${file}`);
                errors++;
                continue;
            }
        } else if (file.endsWith('.svg')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (!content.includes('<svg') || !content.includes('</svg>')) {
                console.error(`[audit] ❌ Malformed SVG structure: ${file}`);
                errors++;
                continue;
            }
        }

        valid++;
        }
    }

    console.log();
    console.log(`[audit] 📊 Audit Complete:`);
    console.log(`  ✅ Valid Assets   : ${valid}`);
    console.log(`  ⚠️  Warnings       : ${warnings}`);
    console.log(`  ❌ Errors         : ${errors}`);
    return { valid, warnings, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    auditLogos();
}
