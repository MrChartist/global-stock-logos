# Curated overrides

Add hand-checked facts here. They always win over automatic data and are never overwritten by the monthly refresh.

`overrides.json` format, keyed by `MARKET:TICKER`:

```json
{
  "US:AAPL": { "slogan": "Think different", "website": "https://www.apple.com" }
}
```

Allowed fields: any profile field (`website`, `founded`, `headquarters`, `ceo`, `ceoSince`, `employees`, `slogan`, `brandColor`, `aliases`, ...). Write where the fact comes from in `_source` (keys that start with `_` are notes and are not published). Do not add slogans you cannot source.

A curated value is published with the source `curated` (and, for a CEO or chairman, confidence `medium`), so the API never credits it to the automatic source it replaced.

When to curate: a fact that is wrong in every automatic source, typically a CEO who left but is still listed on Wikidata without an end date. Better still, also fix it on Wikidata (add the end date, mark the new CEO as preferred), so every user of Wikidata benefits and the next monthly refresh agrees with the override.

## aliases.json

Maps a ticker that has no proper logo (renamed company, or a ticker with a special character) to the ticker that has it, e.g. `"IN:ZOMATO": { "logoOf": "ETERNAL", "reason": "...", "isin": "..." }`. `npm run aliases` copies the logo and `npm run sync` runs it automatically. Only add an alias when it is the same legal entity (check the ISIN).
