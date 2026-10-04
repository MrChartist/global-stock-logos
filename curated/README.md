# Curated overrides

Add hand-checked facts here. They always win over automatic data and are never overwritten by the monthly refresh.

`overrides.json` format, keyed by `MARKET:TICKER`:

```json
{
  "US:AAPL": { "slogan": "Think different", "website": "https://www.apple.com" }
}
```

Allowed fields: any profile field (`website`, `founded`, `headquarters`, `ceo`, `employees`, `slogan`, `brandColor`, `aliases`, ...). Add a source link in your pull request. Do not add slogans you cannot source.
