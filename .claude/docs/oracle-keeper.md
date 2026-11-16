# Oracle and keeper — `scripts/keeper.mjs`

```bash
RPC_URL=… RELAYER_KEY=0x… SIGNER_KEYS=0xk1,0xk2 SIGNER_VENUES=gemini,polymarket \
  [INTERVAL_MS=15000] node scripts/keeper.mjs [--once]
```

- Each signer key quotes **one venue** (`gemini` | `polymarket`). `SIGNER_KEYS` and `SIGNER_VENUES` are same-length, comma-separated, and the addresses must be registered on-chain via `setSigner`.
- The relayer (any funded account) submits `updatePrice`. Reads `scripts/deployment.json` for address/chain.
- Per on-chain market (by name), the keeper resolves venue ids: by default the name is a Gemini instrument symbol (`GEMI-BTC2611202200-HI63000`); `scripts/keeper.markets.json` overrides: `{ "<market name>": { "gemini": "GEMI-…", "polymarket": "<conditionId>" } }`.
- Submit rule: price moved ≥ 0.5¢ or last update older than 60s. Timestamp = `max(latest block ts, priceTime + 1)` (contract requires strictly newer).
- Needs a quorum of quotes; with fewer it logs `n/m quotes — skipping`.

## Price rules

- **Gemini:** mid of best bid/ask if spread ≤ 0.1, else last trade. Endpoint `https://api.gemini.com/v1/prediction-markets/events`.
- **Polymarket:** Gamma API `https://gamma-api.polymarket.com/markets`; YES price = `outcomePrices[outcomes.indexOf("Yes")]`.
- **Resolution:** venue reports closed/resolved with price 0 or 1. The keeper sends `finalized=true` **only if every quoting venue agrees**. This settles the market irreversibly.

## Failure modes seen

- `bad signer`: signer address not registered / wrong key.
- `not newer`: timestamp ≤ `priceTime`.
- Gemini request timeouts (8s limit) → skipped quote; retries next interval.
- Real-world resolution can finalize a freshly listed test market immediately. Pick markets with future expiry.

## Trust model (be honest about this)

One process holding all signer keys = one trusted party. For production: one operator per signer on separate infra (HSM/KMS), more venues, jump-limit sanity checks, alerting on staleness, and a dispute path.
