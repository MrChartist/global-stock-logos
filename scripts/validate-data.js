/**
 * validate-data.js — Correctness checks for company profile data and manifests.
 *
 *   node scripts/validate-data.js          # report; exit 1 on any error
 *   node scripts/validate-data.js --fix    # blank out values that fail validation (never invents values)
 *
 * Errors: malformed ISIN (format or check digit), colour, currency, country code, flag, URL, founding year,
 *         employee count, market cap; manifest entries whose files are missing.
 * Warnings: market data older than 45 days; listings the market scan no longer returns (their last data keeps its date).
 * Writes data-quality-report.json.
 */
import fs from 'fs';
import path from 'path';
import { ROOT, loadShard, saveShard, flag } from './enrich-store.js';

const FIX = process.argv.includes('--fix');
const YEAR = new Date().getFullYear();
const today = Date.parse(new Date().toISOString().slice(0, 10));

/** ISIN check digit (Luhn over the letters-as-numbers expansion). */
export function isinValid(isin) {
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
    const digits = [...isin].map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)).join('');
    let sum = 0, dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = +digits[i];
        if (dbl) { n *= 2; if (n > 9) n -= 9; }
        sum += n; dbl = !dbl;
    }
    return sum % 10 === 0;
}
const urlOk = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') && !/\s/.test(u); } catch { return false; } };

const rules = {
    isin: (v) => isinValid(v),
    brandColor: (v) => /^#[0-9A-F]{6}$/.test(v),
    currency: (v) => /^[A-Z]{3}$/.test(v),
    countryCode: (v) => /^[A-Z]{2}$/.test(v),
    website: (v) => urlOk(v),
    founded: (v) => Number.isInteger(v) && v >= 1000 && v <= YEAR,
    employees: (v) => Number.isInteger(v) && v > 0 && v < 5e6,
    headquarters: (v) => typeof v === 'string' && v.length > 1 && v.length < 140 && !/undefined|null/i.test(v),
    chairman: (v) => typeof v === 'string' && v.length > 1 && v.length < 140,
    address: (v) => typeof v === 'string' && v.length > 3 && v.length < 300,
    addressLocal: (v) => typeof v === 'string' && v.length > 1 && v.length < 300,
    headquartersLocal: (v) => typeof v === 'string' && v.length > 1 && v.length < 300,
    listingDate: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1600-01-01' && v <= new Date().toISOString().slice(0, 10),
    marketCapUsd: (v) => Number.isFinite(v) && v > 0,
    marketCapInr: (v) => Number.isFinite(v) && v > 0,
    capCurrency: (v) => /^[A-Z]{3}$/.test(v),
    cik: (v) => /^\d{10}$/.test(v),
    ceo: (v) => typeof v === 'string' && v.length > 1 && v.length < 120 && !/^Q\d+$/.test(v),
    ceoSince: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1800-01-01' && v <= new Date().toISOString().slice(0, 10),
    wikidata: (v) => /^Q\d+$/.test(v),
    lei: (v) => /^[A-Z0-9]{18}[0-9]{2}$/.test(v),
};

/** Websites are kept at the site root (scheme + host). Paths like /br/ or /schinese are regional pages. */
const siteRoot = (u) => { try { const x = new URL(u); return `${x.protocol}//${x.hostname.toLowerCase()}`; } catch { return u; } };
const errors = {}, warnings = { staleMarketData: 0 };
const sample = [];
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
let records = 0, fixed = 0;

for (const f of fs.readdirSync(path.join(ROOT, 'enrichment'))) {
    const market = f.replace('.json', '');
    const shard = loadShard(market);
    let changed = false;
    for (const [sym, rec] of Object.entries(shard)) {
        records++;
        if (rec.website && urlOk(rec.website) && siteRoot(rec.website) !== rec.website) {
            bump(warnings, 'websiteHadPath');
            if (FIX) { rec.website = siteRoot(rec.website); changed = true; fixed++; }
        }
        for (const [field, ok] of Object.entries(rules)) {
            if (rec[field] == null) continue;
            if (!ok(rec[field])) {
                bump(errors, field);
                if (sample.length < 40) sample.push(`${market}:${sym} ${field}=${JSON.stringify(rec[field])}`);
                if (FIX) { rec[field] = null; delete rec.sources?.[field]; changed = true; fixed++; }
            }
        }
        if (rec.countryCode && rec.flag && flag(rec.country) !== rec.flag) { bump(errors, 'flagMismatch'); if (FIX) { rec.flag = flag(rec.country); changed = true; fixed++; } }
        // A listing the market scan no longer returns (delisted, renamed, a fund) keeps its last known data and date.
        if (rec.notInScan) bump(warnings, 'notInMarketScan');
        else if (rec.marketDataAt && (today - Date.parse(rec.marketDataAt)) / 864e5 > 45) warnings.staleMarketData++;
    }
    if (changed) saveShard(market, shard);
}

// Manifest <-> files <-> PNGs
let manifestEntries = 0;
const manifestDir = path.join(ROOT, 'manifests');
for (const f of fs.readdirSync(manifestDir)) {
    const m = JSON.parse(fs.readFileSync(path.join(manifestDir, f), 'utf-8'));
    for (const [sym, v] of Object.entries(m)) {
        manifestEntries++;
        if (!fs.existsSync(path.join(ROOT, v.path))) bump(errors, 'manifestMissingLogoFile');
        if (v.marketCap != null && !(v.marketCap > 0)) bump(errors, 'marketCap');
        for (const p of Object.values(v.pngPaths || {})) if (!fs.existsSync(path.join(ROOT, p))) bump(errors, 'manifestMissingPng');
    }
}
const total = Object.values(errors).reduce((a, b) => a + b, 0);
const report = { checkedAt: new Date().toISOString().slice(0, 10), enrichmentRecords: records, manifestEntries, errors, warnings, fixed, sample };
fs.writeFileSync(path.join(ROOT, 'data-quality-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ records, manifestEntries, errors, warnings, fixed }, null, 2));
if (sample.length) console.log(sample.slice(0, 12).join('\n'));
process.exit(total && !FIX ? 1 : 0);
