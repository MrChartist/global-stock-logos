/**
 * listings.js — Which listings in the catalogue are the same company, and which of them is its main listing.
 *
 * WHY: one company trades in many markets (NVIDIA in about 30: CEDEARs, BDRs, Thai DRs, Milan and Xetra copies), and the
 * scanner reports the company's full market cap for every one of them. Ranking by market cap alone filled the top of
 * every list with copies. The old rule ("company country differs from the market's country = foreign") was wrong the
 * other way: it pushed Tencent, Alibaba and Xiaomi in Hong Kong (company country China) below every small home listing.
 *
 * RULE: listings with the same brand (TradingView logoid, else a byte-identical logo file) and a market cap within 5%
 * of each other are one company. The brand alone is not enough: Tata Steel and Tata Power share the logoid "tata".
 * A listing the scanner no longer returns (`stale`) has an old market cap, so it joins the largest company of its
 * brand whatever the cap. Its main
 * listing is, in this order: still returned by the scanner; in the company's own country; not a depositary receipt; not a preferred share or
 * depositary-share series (JPMPC, BACPB, GOOGM carry the parent's full market cap); the ticker an alias proves to be
 * the exchange's own spelling (M_M is M&M on NSE; MM is a leftover); the shortest ticker. Every other
 * member is a secondary listing. A listing with no market cap is its own company, secondary only when the scanner calls
 * it a depositary receipt.
 *
 *   const { companies, secondary } = groupListings(listings);
 *   listings:  [{ market: 'us', sym: 'NVDA', name: 'NVIDIA Corporation', cap: 4.6e12, home: true, dr: false, brand: 'nvidia', stale: false }, ...]
 *   companies: [{ cap, main, members }] largest first; secondary: Set of 'market:SYM'
 */
import crypto from 'crypto';

export const logoHash = (buf) => crypto.createHash('md5').update(buf).digest('hex').slice(0, 10);

const CAP_TOLERANCE = 0.05;
const PREFERRED = /\b(pfd|pref|preferred|perp|perpetual|depositary sh|dep sh|notes?|debentures?)\b/i;
/** Lower is a better main listing. */
const mainScore = (l) => [l.stale ? 1 : 0, l.home ? 0 : 1, l.dr ? 1 : 0, PREFERRED.test(l.name || '') ? 1 : 0, l.exchangeSpelling ? 0 : 1, l.sym.length];
const better = (a, b) => { const x = mainScore(a), y = mainScore(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? a : b; return a; };

export function groupListings(listings) {
    // Current listings first, largest first; stale listings last, so they find the current company of their brand.
    const withCap = listings.filter((l) => l.cap > 0).sort((a, b) => (a.stale ? 1 : 0) - (b.stale ? 1 : 0) || b.cap - a.cap);
    const companies = [];
    const byBrand = new Map();
    for (const l of withCap) {
        const groups = byBrand.get(l.brand) || [];
        const same = l.stale ? groups[0] : groups.find((g) => l.cap >= g.cap * (1 - CAP_TOLERANCE));
        if (same) { same.members.push(l); continue; }
        const g = { cap: l.cap, members: [l], main: null };
        companies.push(g);
        byBrand.set(l.brand, [...groups, g]);
    }
    companies.sort((a, b) => b.cap - a.cap);
    const secondary = new Set();
    for (const g of companies) {
        g.main = g.members.reduce(better);
        for (const l of g.members) if (l !== g.main) secondary.add(`${l.market}:${l.sym}`);
    }
    for (const l of listings) if (!(l.cap > 0) && l.dr) secondary.add(`${l.market}:${l.sym}`);
    return { companies, secondary };
}
