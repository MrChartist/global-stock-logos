/**
 * enrich-exchanges.js — Official-registry and exchange sources for markets where Wikidata/GLEIF are thin.
 *
 *   us, hongkong, china : Eastmoney company-profile API (unofficial public endpoint; check its terms before heavy use)
 *   taiwan (OTC)        : TPEx open data (official)
 *   in                  : NSE listing archive (listing date; ISIN cross-check)
 *   australia           : ASX company directory (listing date)
 *   brazil              : B3 official listed-companies API (website, first quotation date; ticker and ISIN verified)
 *   canada              : TMX Money (website, employees; name verified)
 *   japan               : GLEIF by single ISIN (exact; names are in Japanese so batch name checks fail)
 *
 * Verification: a record is accepted only if the source's ISIN equals ours (US, HK), or the exchange code and a close
 * English name agree (China), or the exchange code matches (Taiwan). Mismatches are counted and never written.
 * Only EMPTY fields are filled; each filled field records its source. Resumable (`exchangeAt`), time-boxed.
 *
 *   node scripts/enrich-exchanges.js [--markets us,china] [--max-minutes 60] [--max-age-days 30] [--limit N]
 */
import fs from 'fs';
import path from 'path';
import { ROOT, loadShard, saveShard, similar } from './enrich-store.js';

import { createKit } from './adapter-kit.js';

const kit = createKit(process.argv.slice(2));
const { UA, BOT_UA, sleep, only, deadline, today, meta, company, CJK, clean, site, year, isoDate, setIfEmpty, place, getJson, getText, stats, bump, todo, chunks } = kit;

// ---------------------------------------------------------------- Eastmoney (US, HK, China)
const EM = 'https://datacenter.eastmoney.com/securities/api/data/v1/get';
async function eastmoney(report, columns, filter) {
    const q = new URLSearchParams({ reportName: report, columns, filter, pageSize: '500' });
    const j = await getJson(`${EM}?${q}`, { Referer: 'https://emweb.securities.eastmoney.com/' });
    return j === undefined ? undefined : (j?.result?.data || []);
}
const EM_CFG = {
    us: {
        report: 'RPT_USF10_INFO_ORGPROFILE', size: 80,
        columns: 'SECUCODE,SECURITY_CODE,ORG_EN_ABBR,FOUND_DATE,CHAIRMAN,ADDRESS,EMP_NUM,ORG_WEB,ISIN_CODE',
        filter: (items) => `(SECURITY_CODE in (${items.map(([s]) => `"${s.replace(/"/g, '')}"`).join(',')}))`,
        key: (r) => r.SECURITY_CODE,
    },
    hongkong: {
        report: 'RPT_HKF10_INFO_ORGPROFILE', size: 80,
        columns: 'SECUCODE,SECURITY_CODE,ORG_EN_ABBR,ISIN_CODE,LISTING_DATE,FOUND_DATE,CHAIRMAN,REG_ADDRESS,ADDRESS,EMP_NUM,ORG_WEB',
        filter: (items) => `(SECURITY_CODE in (${items.map(([s]) => `"${s.padStart(5, '0')}"`).join(',')}))`,
        key: (r) => String(+r.SECURITY_CODE),
    },
    china: {
        report: 'RPT_F10_BASIC_ORGINFO', size: 80,
        columns: 'SECUCODE,SECURITY_CODE,ORG_NAME_EN,PRESIDENT,CHAIRMAN,ORG_WEB,ADDRESS,REG_ADDRESS,EMP_NUM,LISTING_DATE,FOUND_DATE',
        suffix: { SSE: 'SH', SZSE: 'SZ', BSE: 'BJ' },
        filter: (items, cfg) => `(SECUCODE in (${items.map(([s, v]) => `"${s}.${cfg.suffix[v.exchange] || 'SH'}"`).join(',')}))`,
        key: (r) => r.SECURITY_CODE,
    },
};
async function runEastmoney(market) {
    const cfg = EM_CFG[market];
    const shard = loadShard(market);
    const items = todo(market, shard);
    for (const batch of chunks(items, cfg.size)) {
        if (Date.now() > deadline) break;
        const rows = await eastmoney(cfg.report, cfg.columns, cfg.filter(batch, cfg));
        if (rows === undefined) break;
        const bySym = new Map();
        for (const r of rows) (bySym.get(cfg.key(r)) || bySym.set(cfg.key(r), []).get(cfg.key(r))).push(r);
        for (const [sym, rec] of batch) {
            rec.exchangeAt = today;
            const cands = bySym.get(sym) || [];
            // Verification: ISIN equality when both sides have one; otherwise exchange code plus a close English name.
            const ok = cands.find((r) => (r.ISIN_CODE && rec.isin) ? r.ISIN_CODE === rec.isin : similar(company(market, sym), r.ORG_EN_ABBR || r.ORG_NAME_EN || '') >= (market === 'china' ? 0.6 : 0.8));
            if (!cands.length) { bump(market, 'notFound'); continue; }
            if (!ok) { bump(market, 'verificationFailed'); continue; }
            let n = 0;
            n += setIfEmpty(rec, 'website', site(ok.ORG_WEB), 'eastmoney');
            n += setIfEmpty(rec, 'founded', year(ok.FOUND_DATE), 'eastmoney');
            n += setIfEmpty(rec, 'listingDate', isoDate(ok.LISTING_DATE), 'eastmoney');
            n += place(rec, 'address', ok.REG_ADDRESS && !CJK.test(ok.REG_ADDRESS) ? ok.REG_ADDRESS : ok.ADDRESS, 'eastmoney');
            if (ok.REG_ADDRESS && CJK.test(ok.REG_ADDRESS)) n += place(rec, 'address', ok.REG_ADDRESS, 'eastmoney');
            n += setIfEmpty(rec, 'chairman', clean(ok.CHAIRMAN), 'eastmoney');
            n += setIfEmpty(rec, 'ceo', clean(ok.PRESIDENT)?.replace(/\(代\)$/, ''), 'eastmoney');
            if (Number.isInteger(ok.EMP_NUM) && ok.EMP_NUM > 0 && !rec.employees) n += setIfEmpty(rec, 'employees', ok.EMP_NUM, 'eastmoney');
            bump(market, n ? 'filled' : 'nothingNew');
        }
        saveShard(market, shard);
        await sleep(900);
    }
    saveShard(market, shard);
}

// ---------------------------------------------------------------- Taiwan OTC (TPEx)
async function runTpex() {
    const market = 'taiwan';
    const list = await getJson('https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O');
    if (!list) return;
    const byCode = new Map(list.map((r) => [String(r.SecuritiesCompanyCode).trim(), r]));
    const shard = loadShard(market);
    for (const [sym, rec] of todo(market, shard)) {
        const r = byCode.get(sym);
        rec.exchangeAt = today;
        if (!r || (rec.exchange && !/TPEX|OTC/i.test(rec.exchange))) { bump(market, 'notOnTpex'); continue; }
        const webKey = Object.keys(r).find((k) => /web|url|http/i.test(k));
        let n = 0;
        n += setIfEmpty(rec, 'website', site(webKey && r[webKey]), 'tpex');
        n += place(rec, 'address', r.Address, 'tpex');
        n += setIfEmpty(rec, 'chairman', clean(r.Chairman), 'tpex');
        n += setIfEmpty(rec, 'ceo', clean(r.GeneralManager)?.replace(/\(.*\)$/, ''), 'tpex');
        n += setIfEmpty(rec, 'founded', year(isoDate(r.DateOfIncorporation)), 'tpex');
        n += setIfEmpty(rec, 'listingDate', isoDate(r.DateOfListing), 'tpex');
        bump(market, n ? 'filled' : 'nothingNew');
    }
    saveShard(market, shard);
}

// ---------------------------------------------------------------- India (NSE archive) and Australia (ASX): listing dates + ISIN cross-check
async function runNse() {
    const market = 'in';
    const csv = await getText('https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv');
    if (!csv) return;
    const MON = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
    const rows = new Map(csv.trim().split('\n').slice(1).map((l) => { const c = l.split(','); return [c[0].trim(), { date: c[3]?.trim(), isin: c[6]?.trim() }]; }));
    const shard = loadShard(market);
    for (const [sym, rec] of todo(market, shard)) {
        const r = rows.get(sym); rec.exchangeAt = today;
        if (!r) continue;
        if (r.isin && rec.isin && r.isin !== rec.isin) { bump(market, 'isinMismatch'); (rec.checks ||= {}).isinNse = r.isin; continue; }
        const m = (r.date || '').match(/^(\d{2})-([A-Z]{3})-(\d{4})$/);
        const n = m ? setIfEmpty(rec, 'listingDate', `${m[3]}-${MON[m[2]]}-${m[1]}`, 'nse-archive') : 0;
        if (r.isin && rec.isin === r.isin) bump(market, 'isinConfirmed');
        bump(market, n ? 'filled' : 'nothingNew');
    }
    saveShard(market, shard);
}
async function runAsx() {
    const market = 'australia';
    const csv = await getText('https://asx.api.markitdigital.com/asx-research/1.0/companies/directory/file', { 'User-Agent': BOT_UA });
    if (!csv) return;
    const rows = new Map(csv.trim().split('\n').slice(1).map((l) => { const c = l.match(/("([^"]*)"|[^,]+)/g)?.map((x) => x.replace(/^"|"$/g, '')) || []; return [c[0], c[3]]; }));
    const shard = loadShard(market);
    for (const [sym, rec] of todo(market, shard)) {
        rec.exchangeAt = today;
        const d = (rows.get(sym) || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        bump(market, setIfEmpty(rec, 'listingDate', d ? `${d[3]}-${d[2]}-${d[1]}` : null, 'asx') ? 'filled' : 'nothingNew');
    }
    saveShard(market, shard);
}

// ---------------------------------------------------------------- Japan: GLEIF by single ISIN (exact)
async function runJapan() {
    const market = 'japan';
    const shard = loadShard(market);
    for (const [sym, rec] of todo(market, shard).filter(([, v]) => v.isin && !v.headquarters && !v.headquartersLocal)) {
        if (Date.now() > deadline) break;
        const j = await getJson(`https://api.gleif.org/api/v1/lei-records?filter%5Bisin%5D=${rec.isin}`, { 'User-Agent': BOT_UA });
        if (j === undefined) break;
        rec.exchangeAt = today;
        const r = (j?.data || []).find((x) => x.attributes.entity.status === 'ACTIVE' && x.attributes.entity.headquartersAddress?.country === 'JP');
        if (!r) { bump(market, 'notInGleif'); await sleep(1100); continue; }
        const hq = r.attributes.entity.headquartersAddress;
        let n = place(rec, 'headquarters', [hq.city, hq.country].filter(Boolean).join(', '), 'gleif-isin');
        n += setIfEmpty(rec, 'lei', r.attributes.lei, 'gleif-isin');
        bump(market, n ? 'filled' : 'nothingNew');
        if ((stats[market]?.filled || 0) % 50 === 0) saveShard(market, shard);
        await sleep(1100);
    }
    saveShard(market, shard);
}


// ---------------------------------------------------------------- Brazil (B3 official listed-companies API)
async function runB3() {
    const market = 'brazil';
    const B3 = 'https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall';
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
    const issuing = new Map();
    for (let page = 1; page <= 60; page++) {
        const j = await getJson(`${B3}/GetInitialCompanies/${b64({ language: 'en-us', pageNumber: page, pageSize: 120 })}`);
        if (!j) break;
        for (const r of j.results || []) if (r.issuingCompany) issuing.set(r.issuingCompany, r.codeCVM);
        if (page >= (j.page?.totalPages || 0)) break;
        await sleep(300);
    }
    const shard = loadShard(market);
    const details = new Map();
    for (const [sym, rec] of todo(market, shard)) {
        if (Date.now() > deadline) break;
        rec.exchangeAt = today;
        const prefix = sym.match(/^[A-Z]{4}/)?.[0];
        const cvm = prefix && issuing.get(prefix);
        if (!cvm) { bump(market, 'notOnB3'); continue; }
        if (!details.has(cvm)) { details.set(cvm, await getJson(`${B3}/GetDetail/${b64({ codeCVM: cvm, language: 'en-us' })}`)); await sleep(400); }
        let d = details.get(cvm);
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } details.set(cvm, d); } // B3 wraps the JSON in a string
        if (!d) { bump(market, 'noDetail'); continue; }
        // Verification: this ticker must be one of the company's codes, and its ISIN must equal ours when both exist.
        const code = (d.otherCodes || []).find((c) => c.code === sym) || (d.code === sym ? { code: sym } : null);
        if (!code || (code.isin && rec.isin && code.isin !== rec.isin)) { bump(market, 'verificationFailed'); continue; }
        const q = String(d.dateQuotation || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        let n = 0;
        n += setIfEmpty(rec, 'website', site(d.website), 'b3');
        n += setIfEmpty(rec, 'listingDate', q ? `${q[3]}-${q[1]}-${q[2]}` : null, 'b3');
        bump(market, n ? 'filled' : 'nothingNew');
    }
    saveShard(market, shard);
}

// ---------------------------------------------------------------- Canada (TMX Money GraphQL: TSX and TSXV)
async function runTmx() {
    const market = 'canada';
    const shard = loadShard(market);
    const q = 'query getQuoteBySymbol($symbol: String, $locale: String) { getQuoteBySymbol(symbol: $symbol, locale: $locale) { symbol name exchangeCode website employees } }';
    for (const [sym, rec] of todo(market, shard)) {
        if (Date.now() > deadline) break;
        let d;
        try {
            const res = await fetch('https://app-money.tmx.com/graphql', {
                method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Origin: 'https://money.tmx.com', Referer: 'https://money.tmx.com/' },
                body: JSON.stringify({ operationName: 'getQuoteBySymbol', variables: { symbol: sym, locale: 'en' }, query: q }), signal: AbortSignal.timeout(30000),
            });
            if (res.status === 429) { await sleep(15000); continue; }
            d = res.ok ? (await res.json())?.data?.getQuoteBySymbol : null;
        } catch { d = null; }
        rec.exchangeAt = today;
        if (!d || d.symbol !== sym) { bump(market, 'notOnTmx'); await sleep(250); continue; }
        if (similar(company(market, sym), d.name) < 0.8) { bump(market, 'verificationFailed'); await sleep(250); continue; }
        let n = 0;
        n += setIfEmpty(rec, 'website', site(d.website), 'tmx');
        const emp = parseInt(d.employees, 10);
        if (emp > 0 && !rec.employees) n += setIfEmpty(rec, 'employees', emp, 'tmx');
        bump(market, n ? 'filled' : 'nothingNew');
        if (((stats[market]?.filled || 0) + (stats[market]?.nothingNew || 0)) % 100 === 0) saveShard(market, shard);
        await sleep(300);
    }
    saveShard(market, shard);
}

const RUN = { us: () => runEastmoney('us'), hongkong: () => runEastmoney('hongkong'), china: () => runEastmoney('china'), taiwan: runTpex, in: runNse, australia: runAsx, brazil: runB3, canada: runTmx, japan: runJapan };
for (const m of Object.keys(RUN)) {
    if (only && !only.includes(m)) continue;
    if (Date.now() > deadline) { console.log('Time budget reached; rerun to continue.'); break; }
    await RUN[m]();
    console.log(`[${m}]`, JSON.stringify(stats[m] || {}));
}
// Plug-in adapters (scripts/adapters/*.js), each owning its own markets.
const adaptersDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'adapters');
for (const f of fs.existsSync(adaptersDir) ? fs.readdirSync(adaptersDir).filter((x) => x.endsWith('.js')).sort() : []) {
    let mod;
    try { mod = await import(new URL(`./adapters/${f}`, import.meta.url)); } catch (e) { console.error(`[adapter ${f}] cannot load: ${e.message}`); continue; }
    if (only && !mod.markets.some((m) => only.includes(m))) continue;
    if (Date.now() > deadline) { console.log('Time budget reached; rerun to continue.'); break; }
    try { await mod.run(kit); } catch (e) { console.error(`[adapter ${f}] failed: ${e.message}`); }
    for (const m of mod.markets) console.log(`[${m}] (${f})`, JSON.stringify(stats[m] || {}));
}
console.log('Done.');
