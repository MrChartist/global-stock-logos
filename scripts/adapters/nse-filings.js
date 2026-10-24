/**
 * nse-filings.js — Indian company profiles from the companies' own NSE filings.
 *
 *   Quarterly "Integrated Filing - Governance" (board composition table): chairperson, CEO (or managing director)
 *   Business Responsibility and Sustainability Report (BRSR) XBRL: website, date of incorporation, registered and
 *   corporate office, permanent and other employees
 *
 * Identity: the NSE symbol must be in NSE's equity list (EQUITY_L.csv) with the same ISIN as our record.
 * Officers from a newer filing replace community data (Wikidata) and older values from this adapter; every other field
 * is only filled when empty. Hand-checked values in curated/overrides.json always win at sync time.
 * Source labels: 'nse-filing' (the filing URL is kept in rec.filingUrls). NSE's public JSON API needs a browser
 * User-Agent and an NSE Referer; terms for bulk use are not stated: Needs verification. About one request per second.
 *
 *   node scripts/enrich-exchanges.js --markets in [--limit 200] [--max-minutes 120] [--max-age-days 30]
 */
export const markets = ['in'];
export const description = 'NSE governance and BRSR filings: chairperson, CEO/MD, website, incorporation, offices, employees';

const API = 'https://www.nseindia.com/api';
const H = { Referer: 'https://www.nseindia.com/', Accept: 'application/json, text/plain, */*' };
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
    'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Chandigarh',
    'Jammu and Kashmir', 'Puducherry'];
const CITY_ALIASES = { bombay: 'Mumbai', bangalore: 'Bengaluru', calcutta: 'Kolkata', madras: 'Chennai', gurgaon: 'Gurugram', 'new delhi': 'New Delhi', poona: 'Pune', baroda: 'Vadodara' };
const OFFICER_SOURCES_TO_REPLACE = new Set(['wikidata', 'wikidata-name', 'nse-filing']);

const text = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const titleCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()) : s);
const personName = (s) => titleCase(text(s).replace(/^(Mr|Mrs|Ms|Dr|Shri|Smt)\.?\s+/i, '')).trim() || null;

/** Board table of an integrated governance filing (iXBRL HTML) -> [{ name, cat1, cat2, cat3, ceased }]. */
export function parseBoard(html) {
    for (const table of html.split(/<table\b/i).slice(1)) {
        const rows = [...table.split(/<\/table>/i)[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => text(c[1])));
        const hi = rows.findIndex((r) => r.some((c) => /^Name of the Director$/i.test(c)) && r.some((c) => /^Category 1 of directors$/i.test(c)));
        if (hi < 0) continue;
        const h = rows[hi], col = (re) => h.findIndex((c) => re.test(c));
        const iName = col(/^Name of the Director$/i), i1 = col(/^Category 1/i), i2 = col(/^Category 2/i), i3 = col(/^Category 3/i), iCease = col(/^Date of cessation$/i);
        return rows.slice(hi + 1).filter((r) => r.length >= h.length - 2 && /^\d+$/.test(r[0] || '')).map((r) => ({
            name: personName(r[iName]), cat1: r[i1] || '', cat2: r[i2] || '', cat3: r[i3] || '', ceased: iCease >= 0 ? (r[iCease] || '').replace(/^-$/, '') : '',
        }));
    }
    return null;
}

/** "Whether the listed entity has a Regular Chairperson": true, false, or null when the filing does not say. */
export function regularChair(html) {
    const m = text(html).match(/Whether the listed entity has a Regular Chairperson\s+(Yes|No)\b/i);
    return m ? m[1].toLowerCase() === 'yes' : null;
}

/** Chairperson and CEO from the board table. CEO = the director titled CEO; else the only managing director.
 *  A company without a regular chairperson (a director is elected to chair each meeting) has no chairman. */
export function officers(board, regular = null) {
    const active = (board || []).filter((d) => d.name && !d.ceased);
    const chair = regular === false ? [] : active.filter((d) => /chair/i.test(d.cat2));
    const ceo = active.filter((d) => /\bCEO\b|Chief Executive/i.test(d.cat3));
    const md = active.filter((d) => /\bMD\b|Managing Director/i.test(d.cat3));
    return {
        chairman: chair.length === 1 ? chair[0].name : null,
        ceo: ceo.length === 1 ? ceo[0].name : ceo.length === 0 && md.length === 1 ? md[0].name : null,
    };
}

/** Values of one BRSR XBRL tag, optionally for one context. */
const tag = (xml, name, ctx) => [...xml.matchAll(new RegExp(`<in-capmkt:${name}\\b([^>]*)>([\\s\\S]*?)</in-capmkt:${name}>`, 'g'))]
    .filter((m) => !ctx || m[1].includes(`contextRef="${ctx}"`)).map((m) => text(m[2]));

/** City (and state) from an Indian office address, using known city names. */
export function cityOf(address, cities) {
    if (!address) return null;
    const a = ` ${address.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ')} `;
    let best = null;
    for (const c of cities) {
        const i = a.lastIndexOf(` ${c.toLowerCase()} `);
        if (i < 0) continue;
        const end = i + c.length;   // the match that ends last wins; on a tie the longer name ("Navi Mumbai" over "Mumbai")
        if (!best || end > best.end || (end === best.end && c.length > best.c.length)) best = { c, end };
    }
    if (!best) return null;
    const state = STATES.find((s) => a.includes(` ${s.toLowerCase()} `) && s.toLowerCase() !== best.c.toLowerCase());
    return [best.c, state, 'India'].filter(Boolean).join(', ');
}

export async function run(kit) {
    const { loadShard, saveShard, getJson, getText, sleep, setIfEmpty, site, year, today, deadline, bump, limit, stale, similar, company, meta } = kit;
    const market = 'in';
    const csv = await getText('https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv');
    if (!csv) { console.log('[nse-filings] equity list unavailable; skipped'); return; }
    const nse = new Map(csv.trim().split('\n').slice(1).map((l) => { const c = l.split(','); return [c[0].trim(), { name: c[1]?.trim(), isin: c[6]?.trim() }]; }));

    // Known city names: the first part of every Indian headquarters we already hold, plus common aliases.
    const shard = loadShard(market);
    const cities = new Set(Object.keys(CITY_ALIASES).map((k) => CITY_ALIASES[k]));
    for (const r of Object.values(shard)) { const c = String(r.headquarters || '').split(',')[0].trim(); if (/^[A-Z][A-Za-z .-]{2,30}$/.test(c) && !STATES.includes(c)) cities.add(c); }
    const cityList = [...cities, ...Object.keys(CITY_ALIASES)];
    const canon = (hq) => { if (!hq) return null; const [c, ...rest] = hq.split(', '); return [CITY_ALIASES[c.toLowerCase()] || c, ...rest].join(', '); };

    const cap = (sym) => shard[sym]?.marketCapUsd || 0;
    const queue = Object.keys(shard).filter((s) => nse.has(s) && stale(shard[s].nseFilingsAt)).sort((a, b) => cap(b) - cap(a)).slice(0, limit);
    const getApi = async (p) => { const j = await getJson(`${API}/${p}`, H); await sleep(900); return j; };
    const getDoc = async (u) => { const t = await getText(u, { Referer: H.Referer }); await sleep(600); return t; };
    let done = 0;
    for (const sym of queue) {
        if (Date.now() > deadline) break;
        const rec = shard[sym], n = nse.get(sym);
        if (rec.isin && n.isin && rec.isin !== n.isin) { bump(market, 'isinMismatch'); rec.nseFilingsAt = today; continue; }
        if (!rec.isin && similar(company(market, sym), n.name) < 0.6) { bump(market, 'verificationFailed'); rec.nseFilingsAt = today; continue; }
        const urls = (rec.filingUrls ||= {});
        let filled = 0;

        // 1. Governance: latest integrated filing (newest broadcast first).
        const gov = await getApi(`integrated-filing-results?index=equities&symbol=${encodeURIComponent(sym)}&type=${encodeURIComponent('Integrated Filing- Governance')}`);
        if (gov === undefined) { bump(market, 'apiUnavailable'); continue; }   // retry next run
        const filings = (gov?.data || []).filter((d) => d.ixbrl && /^https:\/\/nsearchives\.nseindia\.com\//.test(d.ixbrl))
            .sort((a, b) => Date.parse(b.broadcast_Date || 0) - Date.parse(a.broadcast_Date || 0));
        if (filings[0]) {
            const html = await getDoc(filings[0].ixbrl);
            const o = html ? officers(parseBoard(html), regularChair(html)) : {};
            // No regular chairperson: drop a chairman this adapter set earlier from the meeting chair.
            if (html && regularChair(html) === false && rec.sources?.chairman === 'nse-filing') { rec.chairman = null; delete rec.sources.chairman; delete urls.chairman; }
            for (const f of ['ceo', 'chairman']) {
                if (!o[f]) continue;
                const src = rec.sources?.[f];
                if (rec[f] && !OFFICER_SOURCES_TO_REPLACE.has(src)) { if (rec[f] !== o[f]) (rec.checks ||= {})[`${f}Alt`] = { source: 'nse-filing', value: o[f] }; continue; }
                if (rec[f] !== o[f]) filled++;
                rec[f] = o[f]; (rec.sources ||= {})[f] = 'nse-filing'; urls[f] = filings[0].ixbrl;
            }
            rec.governanceAsOf = filings[0].qe_Date || filings[0].broadcast_Date || null;
        } else bump(market, 'noGovernanceFiling');

        // 2. BRSR (the 1,000 largest companies must file it): identity block and employees.
        const brsr = await getApi(`corporate-bussiness-sustainabilitiy?index=equities&symbol=${encodeURIComponent(sym)}`);
        const latest = (brsr?.data || []).filter((d) => d.xbrlFile && /^https:\/\/nsearchives\.nseindia\.com\//.test(d.xbrlFile)).sort((a, b) => (b.fyTo || 0) - (a.fyTo || 0))[0];
        if (latest) {
            const xml = await getDoc(latest.xbrlFile);
            if (xml && /in-capmkt:NameOfTheCompany/.test(xml)) {
                const name = tag(xml, 'NameOfTheCompany')[0];
                if (name && similar(name, n.name) < 0.6) { bump(market, 'brsrNameMismatch'); }
                else {
                    const put = (field, value) => { const k = setIfEmpty(rec, field, value, 'nse-filing'); if (k) urls[field] = latest.xbrlFile; filled += k; };
                    put('website', site(tag(xml, 'WebsiteOfCompany')[0]));
                    put('founded', year(tag(xml, 'DateOfIncorporation')[0]));
                    const real = (v) => (v && !/^\s*(n\.?\s*a\.?|nil|none|-+|same as above)\s*$/i.test(v) ? v : null);   // filings write "NA" for no separate office
                    const office = real(tag(xml, 'AddressOfCorporateOfficeOfCompany')[0]) || real(tag(xml, 'AddressOfRegisteredOfficeOfCompany')[0]);
                    put('address', office && office.length < 300 ? office : null);
                    put('headquarters', canon(cityOf(office, cityList)));
                    const emp = parseInt(tag(xml, 'NumberOfEmployeesOrWorkersIncludingDifferentlyAbled', 'D_Gender_Employees_TableA')[0], 10);
                    put('employees', emp > 0 && emp < 5e6 ? emp : null);
                    if (rec.founded && rec.sources?.founded === 'nse-filing') (rec.checks ||= {}).foundedNote = 'year of incorporation of the listed entity';
                }
            }
        }
        rec.nseFilingsAt = today;
        bump(market, filled ? 'filled' : 'nothingNew');
        if (++done % 25 === 0) { saveShard(market, shard); console.log(`[nse-filings] ${done}/${queue.length}`); }
    }
    saveShard(market, shard);
}
