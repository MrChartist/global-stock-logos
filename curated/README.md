# Curated overrides

Add hand-checked facts here. They always win over automatic data and are never overwritten by the monthly refresh.

`overrides.json` format, keyed by `MARKET:TICKER`:

```json
{
  "US:AAPL": { "slogan": "Think different", "website": "https://www.apple.com" }
}
```

Allowed fields: any profile field (`website`, `founded`, `headquarters`, `ceo`, `employees`, `slogan`, `brandColor`, `aliases`, ...). Add a source link in your pull request. Do not add slogans you cannot source.

## aliases.json

Maps a ticker that has no proper logo (renamed company, or a ticker with a special character) to the ticker that has it, e.g. `"IN:ZOMATO": { "logoOf": "ETERNAL", "reason": "...", "isin": "..." }`. `npm run aliases` copies the logo and `npm run sync` runs it automatically. Only add an alias when it is the same legal entity (check the ISIN).
