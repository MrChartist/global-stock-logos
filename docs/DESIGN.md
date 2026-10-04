# Design system

The catalogue page ([`index.html`](../index.html), [`assets/`](../assets/)) follows the look of [mrchartist.com](https://mrchartist.com) and [ipodecode.mrchartist.com](https://ipodecode.mrchartist.com). The values below were measured from those sites (computed styles in light and dark), not estimated.

## Colour

| Token | Light | Dark |
| :--- | :--- | :--- |
| Page background | `#F9F8F5` | `#0F0E0D` |
| Surface (cards, sheet) | `#FEFEFD` | `#171514` |
| Ink | `#1A1614` | `#F7F5F3` |
| Secondary text | ink at 64% | ink at 66% |
| Hairline ring (instead of borders) | ink at 9% | warm white at 10% |
| Accent (chips, italic word, links) | `#A34414` | `#ECAD89` |
| Primary button | `#1A1614` on `#F9F8F5` | `#F7F5F3` on `#0F0E0D` |

All tokens are CSS variables at the top of [`assets/style.css`](../assets/style.css). The theme follows the system setting until the visitor chooses; the choice is saved. `?theme=light` and `?theme=dark` force a theme (useful for sharing a link and for tests).

## Type

Plus Jakarta Sans at weight 580 to 800 with negative tracking for display, labels and buttons; Inter for body text; DM Serif Display italic for one accent phrase. Numbers use tabular figures. Fonts are self-hosted: see [`assets/fonts/README.md`](../assets/fonts/README.md).

## Shape and depth

Pill radius (999px) for the navigation, buttons, chips and inputs; 20 to 28px for cards, groups and the sheet. Depth comes from inset hairline rings plus soft layered shadows. The navigation and secondary buttons are frosted glass (`blur(24px) saturate(180%)`).

## Motion

| Use | Curve and time |
| :--- | :--- |
| Entrances (fade up 14px), card reveal (staggered 32ms) | `cubic-bezier(.22, 1, .36, 1)`, 0.6 to 0.8 s |
| Sheet open and close (iOS sheet) | `cubic-bezier(.32, .72, 0, 1)`, 0.5 s in, 0.22 s out |
| Sort control thumb | `cubic-bezier(.32, 1.28, .44, 1)` (slight overshoot), 0.45 s |
| Theme change | circular reveal from the toggle (View Transitions API), 0.65 s; instant where unsupported |

`prefers-reduced-motion` turns all of it off. Only `transform` and `opacity` are animated, so there is no layout shift.

## Behaviour

- Loading shows skeleton cards of the final size (no layout jump). The first screens render from a 158 KB file (`search-index-top.json`); the full 5 MB index loads on demand (search, market, sort, or reaching the end of the list) or when the browser is idle.
- `/` or Ctrl/Cmd+K focuses the search. Escape closes the sheet. On phones the sheet is a bottom sheet you can drag down to dismiss.
- Links carry state: `?q=tata&market=IN&sort=name`, `#/IN/TCS` for a company, `?theme=dark`.
- Every link that comes from data is checked to be http(s) before it is put in the page.

## Quality bar

`npm run lighthouse` runs Lighthouse on mobile and desktop in light and dark. Today: accessibility, best practices, SEO and agentic browsing 100 in all four; performance 100 on desktop and 99 on mobile (the brand fonts cost about half a second on the simulated slow 4G link). CI fails below 95. `npm run test:frontend` runs 18 browser checks, including hostile-data and overflow tests.
