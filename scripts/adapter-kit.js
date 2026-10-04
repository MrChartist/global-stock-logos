/**
 * adapter-kit.js — Shared, tested helpers for every source adapter (enrich-exchanges.js and scripts/adapters/*.js).
 *
 * An adapter is a file scripts/adapters/<name>.js that exports:
 *     export const markets = ['korea'];            // the enrichment shards it writes
 *     export const description = 'what it uses';
 *     export async function run(kit) { ... }       // kit = createKit(...), see the returned object below
 *
 * Rules every adapter follows (see docs/ADAPTERS.md):
 *   - fill only EMPTY fields with kit.setIfEmpty(rec, field, value, 'source-name'); never overwrite
 *   - verify identity before writing (ISIN equal, or exchange code + close name via kit.similar)
 *   - set rec.exchangeAt = kit.today for every record you processed, so the run is resumable
 *   - stop when Date.now() > kit.deadline; be polite (about 1 request per second per host); no logins, no CAPTCHAs
 *   - save with kit.saveShard(market, shard) regularly
 */
import fs from 'fs';
import path from 'path';
import { ROOT, loadShard, saveShard, similar } from './enrich-store.js';

export function createKit(args) {
    const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
    const BOT_UA = 'global-stock-logos/1.0 (https://github.com/MrChartist/global-stock-logos; contact@mrchartist.com)';
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
    const only = opt('--markets') ? opt('--markets').split(',') : null;
    const maxAge = parseInt(opt('--max-age-days', '30'), 10);
    const limit = parseInt(opt('--limit', '1000000'), 10);
    const deadline = Date.now() + parseInt(opt('--max-minutes', '60'), 10) * 60000;
    const today = new Date().toISOString().slice(0, 10);
    const YEAR = new Date().getFullYear();
    const stale = (d) => !d || (Date.parse(today) - Date.parse(d)) / 864e5 >= maxAge;
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'companies-metadata.json'), 'utf-8'));
    const company = (market, sym) => meta[`${market.toUpperCase()}:${sym}`]?.company || sym;

    const CJK = /[⺀-鿿가-힯぀-ヿ]/;
    const clean = (s) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim() || null);
    // Site root only: regional or language paths (/br/, /schinese) are not the company's main site.
    const site = (u) => {
        u = clean(u); if (!u || /^(-|--|n\/a|none)$/i.test(u)) return null;
        u = u.split(/[;,\s]/)[0];
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        try { const x = new URL(u); return x.hostname.includes('.') ? `${x.protocol}//${x.hostname.toLowerCase()}` : null; } catch { return null; }
    };
    const year = (d) => { const y = parseInt(String(d || '').slice(0, 4), 10); return y >= 1000 && y <= YEAR ? y : null; };
    const isoDate = (d) => { d = String(d || '').replace(/\s.*$/, ''); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : null; };
    const sameSite = (a, b) => { const x = host(a), y = host(b); return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`); };
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
    const setIfEmpty = (rec, field, value, source) => {
        if (value == null || value === '') return 0;
        if (rec[field]) {
            // Cross-check: keep our value, but record when an independent source disagrees.
            const differs = field === 'website' ? !sameSite(rec.website, value) : field === 'founded' ? Math.abs(rec.founded - value) > 1 : false;
            if (differs) (rec.checks ||= {})[`${field}Alt`] = { source, value };
            return 0;
        }
        rec[field] = value; (rec.sources ||= {})[field] = source; return 1;
    };
    /** Put a place/address into the English or the local-script field. */
    const place = (rec, base, value, source) => { value = clean(value); return value ? setIfEmpty(rec, CJK.test(value) ? `${base}Local` : base, value, source) : 0; };

    async function getJson(url, headers = {}) {
        for (let a = 0; a < 4; a++) {
            if (Date.now() > deadline) return undefined;
            try {
                const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(60000) });
                if (res.ok) return await res.json();
                if (res.status === 404) return null;
                await sleep(res.status === 429 ? 15000 : 3000 * (a + 1));
            } catch { await sleep(3000 * (a + 1)); }
        }
        return undefined;
    }
    const getText = async (url, headers = {}) => {
        try { const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(90000) }); return r.ok ? await r.text() : null; } catch { return null; }
    };

    const stats = {};
    const bump = (m, k, n = 1) => { (stats[m] ||= {}); stats[m][k] = (stats[m][k] || 0) + n; };
    const todo = (market, shard) => Object.entries(shard).filter(([, v]) => stale(v.exchangeAt)).slice(0, limit);
    const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
    return {
        fs, path, ROOT, loadShard, saveShard, similar,
        UA, BOT_UA, sleep, args, opt, only, maxAge, limit, deadline, today, YEAR, stale, meta, company,
        CJK, clean, site, year, isoDate, host, sameSite, setIfEmpty, place, getJson, getText, stats, bump, todo, chunks,
    };
}
