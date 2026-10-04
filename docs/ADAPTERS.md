# Writing a source adapter

Each market that needs its own source gets one file: `scripts/adapters/<name>.js`. The runner (`node scripts/enrich-exchanges.js`) loads every file in that folder.

```js
// scripts/adapters/korea.js
export const markets = ['korea'];
export const description = 'What source this uses';

export async function run(kit) {
    const { loadShard, saveShard, todo, company, getJson, setIfEmpty, place, site, year, isoDate, similar,
            sleep, today, deadline, bump } = kit;
    const shard = loadShard('korea');
    for (const [sym, rec] of todo('korea', shard)) {
        if (Date.now() > deadline) break;
        rec.exchangeAt = today;                       // marks the record as processed (resumable)
        // 1. fetch from the source
        // 2. VERIFY identity: ISIN equal, or exchange code plus similar(company('korea', sym), theirName) >= 0.8
        // 3. fill only empty fields
        let n = 0;
        n += setIfEmpty(rec, 'website', site(theirWebsite), 'source-name');
        bump('korea', n ? 'filled' : 'nothingNew');
    }
    saveShard('korea', shard);
}
```

## Rules

1. **Verify before you write.** Never accept a match on a ticker alone. Count and skip failures with `bump(market, 'verificationFailed')`.
2. **Fill, never overwrite.** `setIfEmpty` also records a disagreement in `checks` when a second source differs.
3. **Be polite.** About one request per second per host, no logins, no CAPTCHAs, no paid or keyed services unless the key comes from an environment variable and the adapter skips cleanly without it.
4. **Official or open sources first.** Note in a comment what the source is and any terms you could not confirm: Needs verification.
5. **Fields you may fill:** `website`, `founded`, `listingDate`, `address`/`addressLocal`, `headquarters`/`headquartersLocal`, `chairman`, `ceo`, `employees`, `lei`. Use `place()` for addresses, so local-script text goes in the `Local` field.
6. **Test on a sample first** (`--limit 50`), read the output yourself, then run the market. Run `node scripts/validate-data.js` before you finish.
