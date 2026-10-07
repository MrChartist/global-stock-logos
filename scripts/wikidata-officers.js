/**
 * wikidata-officers.js — Pick the current CEO (Wikidata P169) of a company, with the date the term started.
 *
 * WHY: Wikidata keeps every CEO a company ever had. Taking all statements without an end date returned people who
 * left years ago (Tata Consultancy Services, Apple). Editors mark the current one in two ways, so we use both:
 *   1. rank: a "preferred" statement is the current one; "deprecated" statements are wrong and never used;
 *   2. dates: a statement whose end date (P582) has passed is history; among the rest the latest start date (P580) wins.
 * A statement with no dates at all is used only when nothing better exists and it is the only one; the API then reports
 * `since: null` with low confidence, so a reader knows to verify it. Several undated statements give no CEO (null).
 *
 *   const officers = await fetchOfficers(sparql, ['Q312', 'Q2283']);   // Map qid -> { ceo, ceoSince }
 */

/** @param {{ name: string, rank: string, start: string | null, end: string | null }[]} rows @param {string} today YYYY-MM-DD */
export function pickCeo(rows, today) {
    const live = rows.filter((r) => r.rank !== 'deprecated' && !(r.end && r.end.slice(0, 10) <= today));
    if (!live.length) return { ceo: null, ceoSince: null };
    const preferred = live.filter((r) => r.rank === 'preferred');
    const dated = live.filter((r) => r.start);
    const pool = preferred.length ? preferred : dated.length ? dated : live;
    // Several open-ended terms and no rank or date to tell them apart: any choice would be a guess.
    if (pool === live && new Set(live.map((r) => r.name)).size > 1) return { ceo: null, ceoSince: null };
    pool.sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    // Every preferred statement is current (co-CEOs). Otherwise co-CEOs appointed in the same year are both kept:
    // an older open-ended statement is almost always a predecessor whose end date nobody added.
    const year = (pool[0].start || '').slice(0, 4);
    const chosen = preferred.length ? pool : pool.filter((r, i) => i === 0 || (year && (r.start || '').slice(0, 4) === year));
    const names = [...new Set(chosen.map((r) => r.name))].slice(0, 2);
    return { ceo: names.join(' / '), ceoSince: pool[0].start ? pool[0].start.slice(0, 10) : null };
}

const RANK = { 'http://wikiba.se/ontology#PreferredRank': 'preferred', 'http://wikiba.se/ontology#NormalRank': 'normal', 'http://wikiba.se/ontology#DeprecatedRank': 'deprecated' };

/**
 * @param {(query: string) => Promise<any[] | null>} sparql  returns SPARQL JSON bindings, or null on failure
 * @param {string[]} qids
 * @returns {Promise<Map<string, { ceo: string | null, ceoSince: string | null }> | null>} null when the query failed
 */
export async function fetchOfficers(sparql, qids, today = new Date().toISOString().slice(0, 10)) {
    if (!qids.length) return new Map();
    const rows = await sparql(`SELECT ?i ?ceol ?rank ?start ?end WHERE {
      VALUES ?i { ${qids.map((q) => `wd:${q}`).join(' ')} }
      ?i p:P169 ?st. ?st ps:P169 ?p; wikibase:rank ?rank.
      OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
      ?p rdfs:label ?ceol. FILTER(LANG(?ceol)="en") }`);
    if (!rows) return null;
    const by = new Map();
    for (const r of rows) {
        const q = r.i.value.split('/').pop();
        (by.get(q) || by.set(q, []).get(q)).push({
            name: r.ceol.value, rank: RANK[r.rank.value] || 'normal',
            // Wikidata dates look like 2023-06-01T00:00:00Z; a year-only date is stored as YYYY-01-01.
            start: r.start?.value && /^\d{4}-/.test(r.start.value) ? r.start.value : null,
            end: r.end?.value && /^\d{4}-/.test(r.end.value) ? r.end.value : null,
        });
    }
    const out = new Map();
    for (const q of qids) out.set(q, by.has(q) ? pickCeo(by.get(q), today) : { ceo: null, ceoSince: null });
    return out;
}
