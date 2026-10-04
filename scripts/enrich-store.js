/**
 * enrich-store.js — Read/write per-market enrichment shards (enrichment/<market>.json).
 * Each record keeps its own retrieval dates so stale facts can be found and refreshed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = path.join(ROOT, 'enrichment');
fs.mkdirSync(DIR, { recursive: true });

export const loadShard = (market) => {
    const f = path.join(DIR, `${market}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : {};
};
export const saveShard = (market, data) =>
    fs.writeFileSync(path.join(DIR, `${market}.json`), JSON.stringify(data));

/** Country name (as TradingView writes it) -> flag emoji, or null when unknown. */
const byName = new Map();
const dn = new Intl.DisplayNames(['en'], { type: 'region' });
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    let n; try { n = dn.of(code); } catch { continue; }
    if (n && n !== code) byName.set(n.toLowerCase(), code);
}
const ALIASES = { 'czech republic': 'CZ', turkey: 'TR', 'south korea': 'KR', russia: 'RU', 'hong kong': 'HK', taiwan: 'TW', vietnam: 'VN', 'united states': 'US', 'united kingdom': 'GB', 'ivory coast': 'CI', 'democratic republic of the congo': 'CD', macau: 'MO', 'cayman islands': 'KY', 'british virgin islands': 'VG', 'virgin islands (british)': 'VG', 'saint kitts and nevis': 'KN', 'macao': 'MO', 'palestine': 'PS' };
export const iso2 = (country) => (country ? ALIASES[country.toLowerCase()] || byName.get(country.toLowerCase()) || null : null);
export const flag = (country) => {
    const c = iso2(country);
    return c ? String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : null;
};

/** Name similarity used to confirm that a registry record is the same company (0..1). */
const STOP = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|ag|sa|nv|se|spa|oyj|ab|asa|llc|lp|holdings?|group|the|class|shs|ordinary|adr|ads|pcl|bhd|tbk|pvt|public)\b/g;
export const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim();
export const similar = (a, b) => {
    const A = new Set(norm(a).split(' ').filter(Boolean)), B = new Set(norm(b).split(' ').filter(Boolean));
    if (!A.size || !B.size) return 0;
    let h = 0; for (const w of A) if (B.has(w)) h++;
    return h / Math.max(A.size, B.size);
};
