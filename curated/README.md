# Curated overrides

Add hand-checked facts here. They always win over automatic data and are never overwritten by the monthly refresh.

`overrides.json` format, keyed by `MARKET:TICKER`:

```json
{
  "US:AAPL": { "slogan": "Think different", "website": "https://www.apple.com" }
}
```

Allowed fields: `name` (the current name after a rename, until the exchange data catches up), `status`/`delistedAt`/`successor` (a company that was acquired, taken private or moved to a new ticker: `"status": "delisted"`, `"successor": "US:SKYD"`), and any profile field (`website`, `founded`, `headquarters`, `ceo`, `employees`, `slogan`, `brandColor`, `aliases`, ...). Add a source link in your pull request. Do not add slogans you cannot source.

## aliases.json

Maps a ticker that has no proper logo (renamed company, or a ticker with a special character) to the ticker that has it, e.g. `"IN:ZOMATO": { "logoOf": "ETERNAL", "reason": "...", "isin": "..." }`. `npm run aliases` copies the logo and `npm run sync` runs it automatically. Only add an alias when it is the same legal entity (check the ISIN).

## logo-provenance.json

Records where a company's square icon (`logos/<market>/<TICKER>.svg`) was taken from, once it has been checked against the owner's own material. Keyed by `MARKET:TICKER`:

```json
{
  "IN:TCS": { "type": "official-site", "source": "https://www.tcs.com/..." }
}
```

`type` is `official-site`, `press-kit`, `official-document` (all shown in the API as `official`) or `wikimedia-commons` (shown as `commons`); `source` is the URL of the page or file. Logos with no entry here and none in `logo-sources.json` are labelled `crawled` in the API. Add an entry only for a logo you have looked at and compared with the source; the build fails on a bad type or a source that is not a URL.
