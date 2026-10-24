/**
 * build-tokens.js — export the design tokens of assets/style.css as assets/tokens.css and assets/tokens.json.
 *   node scripts/build-tokens.js           write both files
 *   node scripts/build-tokens.js --check   fail if they are out of date (part of npm test)
 * The source of truth is the custom properties in the `:root` block (light) and the
 * `:root[data-resolved="dark"]` block (dark overrides) at the top of assets/style.css.
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from './enrich-store.js';

const SRC = path.join(ROOT, 'assets/style.css');
const OUT_CSS = path.join(ROOT, 'assets/tokens.css');
const OUT_JSON = path.join(ROOT, 'assets/tokens.json');

/** Declarations `--name: value;` of the first block that starts with the selector. @returns {[string, string][]} */
function block(css, selector) {
    const start = css.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`style.css has no "${selector}" block`);
    const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
    const out = [];
    for (const m of body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.push([m[1], m[2].trim().replace(/\s+/g, ' ')]);
    return out;
}

/** Group a token name by what it is for. @param {string} n */
function group(n) {
    if (n.startsWith('--font-')) return 'font';
    if (n.startsWith('--ease')) return 'motion';
    if (n.startsWith('--shadow-')) return 'shadow';
    if (n.startsWith('--r-')) return 'radius';
    if (n === '--nav-h') return 'layout';
    return 'color';
}

export function build() {
    const css = fs.readFileSync(SRC, 'utf8');
    const light = block(css, ':root');
    const darkOver = block(css, ':root[data-resolved="dark"]');
    const lightMap = new Map(light);
    for (const [k] of darkOver) if (!lightMap.has(k)) throw new Error(`dark token ${k} has no light value`);
    const dark = new Map(darkOver);

    const decl = (/** @type {[string,string][]} */ list, pad) => list.map(([k, v]) => `${pad}${k}: ${v};`).join('\n');
    const darkList = darkOver;
    const tokensCss = `/* Global Stock Logos design tokens. Generated from assets/style.css by scripts/build-tokens.js: do not edit.
   Light is the default. Dark follows the system unless <html data-theme="light"> is set, and is forced
   by <html data-theme="dark"> (or data-resolved="dark", which the catalogue page sets). See docs/DESIGN.md. */
:root {
${decl(light, '  ')}
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-resolved="light"]) {
${decl(darkList, '    ')}
    color-scheme: dark;
  }
}
:root[data-theme="dark"], :root[data-resolved="dark"] {
${decl(darkList, '  ')}
  color-scheme: dark;
}
`;
    /** @type {Record<string, any>} */
    const json = { $description: 'Design tokens generated from assets/style.css by scripts/build-tokens.js. Do not edit.', tokens: {} };
    for (const [k, v] of light) {
        const name = k.slice(2);
        json.tokens[name] = { group: group(k), light: v, dark: dark.get(k) ?? v };
    }
    return { css: tokensCss, json: JSON.stringify(json, null, 2) + '\n' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { css, json } = build();
    if (process.argv.includes('--check')) {
        const stale = [[OUT_CSS, css], [OUT_JSON, json]].filter(([f, want]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== want);
        if (stale.length) {
            console.error(`Tokens out of date: ${stale.map(([f]) => path.relative(ROOT, f)).join(', ')}. Run: npm run tokens`);
            process.exit(1);
        }
        console.log('Tokens are up to date.');
    } else {
        fs.writeFileSync(OUT_CSS, css); fs.writeFileSync(OUT_JSON, json);
        console.log(`Wrote assets/tokens.css and assets/tokens.json (${Object.keys(JSON.parse(json).tokens).length} tokens).`);
    }
}
