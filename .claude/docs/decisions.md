# Decisions log

Newest last. Add a line when you make a call others should know about.

1. **Perps on prediction markets, not "impact markets".** The product trades probabilities of outcomes listed on external venues. (Early prototype said impact markets; ignore that framing.)
2. **House-as-counterparty vault** over an AMM/orderbook: simplest to ship, trader wins are bounded by reserved `maxProfit`, so the vault is always solvent. Cost: the house carries directional risk.
3. **Native MON margin**, no ERC-20: fewer moving parts for a hackathon.
4. **Signed oracle with quorum + median** over a single trusted updater, so a second venue/operator can be added without a contract change. All keys in one process for now (known weakness).
5. **Settle at exactly 0/1** only on a `finalized` update, and the keeper only finalizes when all quoting venues agree.
6. **Skew price impact and funding exist but default to 0**; enable per market after simulation.
7. **Entry-price guard:** `openPosition` takes `limitPrice` (added after review: oracle updates can land between quote and mining).
8. **Foundry without forge-std**, with an inline `Vm` interface — keeps the repo dependency-free.
9. **`via_ir = true`** because `openPosition`/`_close` hit stack-too-deep.
10. **No bundler for the frontend**; ethers pinned via CDN with SRI. Revisit when adding more modules.
11. **Bounded `eth_getLogs` lookback** instead of an indexer, because public RPCs cap ranges; indexer is on the roadmap.
