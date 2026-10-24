# Security Policy

## Reporting a problem

Please do not open a public issue for a security problem. Write to [contact@mrchartist.com](mailto:contact@mrchartist.com) with a short description and the file or URL concerned. We will reply as soon as we can.

## Supported surface

The `main` branch only. In scope:

- Logo files (`logos/`, `logos-hd/`, `brands/logos/`, `institutions/logos/`) and the static JSON API under `api/v1/`.
- The catalogue page (`index.html`, `assets/app.js`), the client (`src/client.js`) and the web component (`src/stock-logo.js`).
- GitHub workflows and scripts that run in CI or on a schedule.

Out of scope: wrong or stale company facts (open a normal issue with a source URL) and third-party sites we link to.

## Rules that are enforced

**Logo SVGs are plain vector art.** `npm test` (via `scripts/quality.js --check`, rule in `activeContent()` in `scripts/svg-quality.js`) fails on any SVG with `<script>`, `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`, `<set>`, event-handler attributes, `javascript:` URLs, `@import`, entity declarations, an `href` that is not a local `#id` (or an embedded PNG/JPEG/GIF/WebP), or a `url()` that is not a local `#id`. `scripts/logo-tool.js check` and the pull request check apply the same rule. Even so, serve logos from `<img>` tags (which never run script), or sanitise them first if you inline them.

**The catalogue page runs under a strict Content-Security-Policy** (a `<meta>` tag in `index.html`): `default-src 'none'`; scripts only from this site plus the one hashed inline theme script; styles, fonts and connections from this site; images and API fetches also from `cdn.jsdelivr.net`; no `unsafe-inline` or `unsafe-eval`, no plugins, no `<base>`, no form posts. Rules for the page code:

- No inline event handlers and no `style=` attributes in markup; set styles through the DOM (`element.style`).
- Anything from the API that goes into `innerHTML` goes through `esc()`; links go through `safeUrl()` (http and https only); colours from data are used only if they are plain hex.
- External links carry `rel="noopener noreferrer"`.
- If you edit the inline script in `index.html`, update its `sha256-` in the policy. `npm run test:frontend` fails on any policy violation and on hostile data in the page.

**Workflows** use read-only `contents` permission unless a job commits, have a timeout and a concurrency group, never put PR titles, bodies or branch names into a shell command (they go through `env:`), and do not keep the checkout token in read-only jobs. Actions are pinned to major version tags, not commit SHAs.
