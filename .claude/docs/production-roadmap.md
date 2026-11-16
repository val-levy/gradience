# Path to production

Ordered. Do not skip the first block.

## 1. Prove it
- Browser run against local anvil with a seeded market, then Monad testnet with a real keeper for several days on 2+ real markets.
- Full flow with MetaMask: connect, open, oracle move, close, liquidate, settle.
- Loading/empty/error states; clear revert-reason messages.

## 2. Contract hardening
- External audit before any real funds.
- Foundry invariant tests (conservation of funds, `reserved ≤ houseBalance`) with funding and skew enabled.
- Parameter simulation (leverage, OI caps, skew, funding, fees) on historical prediction-market price paths.
- Owner → multisig + timelock; pause / emergency-settle; decide house-withdraw policy and upgrade strategy.

## 3. Oracle
- Independent signer operators (HSM/KMS), redundant relayers, staleness alerts.
- More sources; per-update jump limits; manipulation checks for thin books.
- Dispute/appeal path when venues disagree or reverse a resolution.
- Reviewed market-listing process (venue id mapping errors would settle the wrong market).

## 4. App / infra
- Indexer (Goldsky/Envio or small service) for history, feed, house P&L over time.
- Dedicated RPC with fallback; CSP and self-hosted/bundled dependencies; reproducible build.
- Monitoring: oracle staleness, free house liquidity, reserve ratio, keeper failures.
- Mobile layout for new screens.

## 5. Product / legal
- Leveraged event derivatives are regulated in many jurisdictions: get legal advice, terms, geo-blocking.
- Decide house model vs LP vault (shared risk) and fee model.
- Mainnet launch behind caps and allowlist.
