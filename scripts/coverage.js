/**
 * coverage.js — Print how complete the profile fields are, for the given markets (or all).
 *   node scripts/coverage.js korea thailand
 */
import fs from 'fs';
import { MARKETS } from './markets.js';
import { loadShard } from './enrich-store.js';

const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const keys = want.length ? want : Object.keys(MARKETS);
const FIELDS = ['website', 'founded', 'listingDate', 'employees', 'ceo', 'chairman', 'lei'];
const rows = [];
for (const k of keys) {
    if (!MARKETS[k]) { console.warn(`unknown market ${k}`); continue; }
    const shard = loadShard(k);
    const recs = Object.values(shard);
    const n = recs.length || 1;
    const pct = (f) => Math.round((100 * recs.filter((r) => r[f] != null && r[f] !== '' && r[f] !== 0).length) / n);
    const loc = Math.round((100 * recs.filter((r) => r.headquarters || r.headquartersLocal || r.address || r.addressLocal).length) / n);
    rows.push({ market: k, companies: recs.length, ...Object.fromEntries(FIELDS.map((f) => [f, pct(f)])), location: loc });
}
console.table(rows);
