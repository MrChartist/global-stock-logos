#!/usr/bin/env node
/**
 * Headline numbers: one definition, checked against the data.
 *
 * Definition: "listed companies" = listings that have a logo file which is not a generated placeholder,
 * i.e. api/v1/index.json `companies` minus `logoProvenance.generated`. (`companies` itself counts every
 * listing, placeholders included; the 452 aliases are separate and never counted.) Texts state it rounded
 * DOWN to a granularity of 1,000, written "80,000+".
 *
 * npm run numbers            print the numbers and the wording to use
 * npm run numbers -- --check fail if the provenance counts in README.md and docs/PRODUCTION.md differ, or
 *                            if README.md, CLAUDE.md, package.json, docs/API.md or index.html state a
 *                            different headline number (or a different number of markets)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRANULARITY = 1000;
const FILES = ['README.md', 'CLAUDE.md', 'package.json', 'docs/API.md', 'index.html'];

export function headline(root = ROOT) {
    const idx = JSON.parse(fs.readFileSync(path.join(root, 'api/v1/index.json'), 'utf8'));
    const prov = idx.logoProvenance || {};
    const generated = idx.logoProvenance?.generated ?? 0;
    const withLogo = idx.companies - generated;
    const floor = Math.floor(withLogo / GRANULARITY) * GRANULARITY;
    return { prov, listings: idx.companies, generated, aliases: idx.aliases, withLogo, floor, markets: idx.markets, text: `${floor.toLocaleString('en-US')}+` };
}

// Claims: "75,000+ listed stocks", "80,000+ companies" and the shields.io badge "companies-75%2C000%2B".
const BADGE = /companies-(\d{1,3}(?:%2C\d{3})+)%2B/gi;
const MARKETS = /\b(\d+) markets\b/g;

export function findClaims(text) {
    const claims = [];
    for (const m of text.matchAll(BADGE)) claims.push({ kind: 'headline', value: Number(m[1].replace(/%2C/gi, '')), raw: m[0] });
    for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})+)\+\s+(?:listed\s+)?(?:stocks|companies|listings)/gi)) claims.push({ kind: 'headline', value: Number(m[1].replace(/,/g, '')), raw: m[0] });
    for (const m of text.matchAll(MARKETS)) claims.push({ kind: 'markets', value: Number(m[1]), raw: m[0] });
    return claims;
}

function main() {
    const h = headline();
    const check = process.argv.includes('--check');
    if (!check) {
        console.log(`Listings (api/v1/index.json companies): ${h.listings}`);
        console.log(`Generated placeholders:                  ${h.generated}`);
        console.log(`Listings with a logo (the headline):     ${h.withLogo}  ->  "${h.text}" (rounded down to ${GRANULARITY.toLocaleString('en-US')})`);
        console.log(`Aliases (not counted):                   ${h.aliases}`);
        console.log(`Markets:                                 ${h.markets}`);
        return;
    }
    const errors = [];
    let seen = 0;
    for (const f of FILES) {
        const p = path.join(ROOT, f);
        if (!fs.existsSync(p)) { errors.push(`${f}: file not found`); continue; }
        const claims = findClaims(fs.readFileSync(p, 'utf8'));
        if (!claims.some((c) => c.kind === 'headline') && ['README.md', 'CLAUDE.md', 'package.json'].includes(f)) errors.push(`${f}: no headline number found`);
        for (const c of claims) {
            seen++;
            const want = c.kind === 'headline' ? h.floor : h.markets;
            if (c.value !== want) errors.push(`${f}: "${c.raw}" should be ${c.kind === 'headline' ? `"${h.text}"` : want} (${c.kind === 'headline' ? `${h.withLogo} listings with a logo, rounded down to ${GRANULARITY}` : 'api/v1/index.json markets'})`);
        }
    }
    // The provenance table in README.md and docs/PRODUCTION.md states exact counts.
    for (const f of ['README.md', 'docs/PRODUCTION.md']) {
        const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
        for (const [k, n] of Object.entries(h.prov)) {
            const row = text.match(new RegExp('^\\| `' + k + '` \\|.*\\| ([\\d,]+) \\|$', 'm'));
            if (!row) errors.push(`${f}: no provenance row for \`${k}\``);
            else if (Number(row[1].replace(/,/g, '')) !== n) errors.push(`${f}: provenance \`${k}\` says ${row[1]}, api/v1/index.json says ${n.toLocaleString('en-US')}`);
        }
    }
    if (errors.length) {
        console.error('Headline numbers out of date:\n' + errors.map((e) => '  ' + e).join('\n') + '\nRun: node scripts/numbers.js');
        process.exit(1);
    }
    console.log(`numbers: ${seen} claims in ${FILES.length} files match api/v1/index.json (${h.text} listed companies, ${h.markets} markets)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
