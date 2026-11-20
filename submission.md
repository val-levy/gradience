## Inspiration
Prediction markets have become one of the best real-time signals for what people expect to happen, but trading them is all-or-nothing: you buy a share and wait until the event resolves. You can't easily lever up on a conviction, short a probability you think is overpriced, or trade the *move* from 40¢ to 60¢ without holding to expiry. Crypto solved this for assets with perpetual futures. We wanted the same thing for probabilities, on a chain fast and cheap enough to update prices every few seconds.

## What it does
Gradience lets you go long or short the probability (0–100¢) of a real prediction-market outcome (NBA totals, NFL props, Champions League spreads, crypto prices, even tomorrow's weather) with up to 25× leverage, using MON as margin on Monad.

  - **Live prices from real venues.** Markets mirror contracts listed on Gemini (Polymarket supported in the oracle), and an oracle keeper streams signed prices on-chain.
  - **A house vault is the counterparty.** When you open a position, the vault reserves your maximum possible profit, so it can always pay every winner. Solvency holds by construction, and we fuzz-test it.
  - **Real settlement.** When the venue resolves the event, the market settles at exactly 0¢ or 100¢ and positions pay out.
  - **Full trading flow.** Markets, a trade ticket with skew-aware entry price, liquidation estimate and slippage protection, a My Positions page with live P&L, and a House dashboard showing vault balance, open interest, and "if YES / if NO" P&L scenarios, with liquidation buttons.

  ## How we built it
  - **Smart contract (Solidity, Foundry):** `PredictionPerps.sol` handles markets, positions, the house vault, liquidations, funding, open-interest skew price impact, a slippage guard on entry, a 7-day fail-safe exit after expiry, and settlement.
  - **Oracle:** prices are EIP-712-signed by independent signer keys (one per venue). The contract requires a quorum of signatures, takes the median, rejects stale or replayed updates, and only settles on a finalized update that every quoting venue agrees on.
  - **Keeper (Node + ethers v6):** fetches Gemini and Polymarket prices, signs them, and relays them on-chain. It runs as a local process or as a Cloudflare cron Worker.
  - **Frontend:** a static, dependency-light app (vanilla JS + ethers v6 via CDN with Subresource Integrity) talking directly to the contract through MetaMask.
  - **Tests:** 13 Foundry tests, including a solvency fuzz test that random-walks prices and checks the house can always pay, plus frontend tests that mirror the contract's entry and liquidation math.

  ## Challenges we ran into
  - **Keeping the house solvent with leverage on a bounded asset.** Probabilities are capped at 0 and 1, so long and short P&L aren't symmetric. We reserve each position's exact maximum payout at open and clamp losses to margin, then fuzz-tested that the vault never goes underwater.
  - **Oracle design under hackathon time.** A single trusted updater would have been easy but fragile. We built quorum + median signatures so more venues or operators can be added without a contract change.
  - **Price freshness vs. gas.** The contract rejects stale prices, so the keeper must refresh every market regularly, and that costs gas. We tuned the staleness window and update rules to balance safety against MON spend.
  - **Messy real-world data.** Venue symbols, event IDs and resolution formats differ across market types (sports vs. crypto vs. weather), and bulk feeds are large and flaky. We fixed parsing bugs that silently skipped whole categories of markets, and made data fetching page and retry.
  - **Slippage between quote and mining.** An oracle update can land between when you see a price and when your trade mines, so `openPosition` takes a limit price.

## Accomplishments that we're proud of
  - An end-to-end, on-chain perps exchange for prediction markets, live on Monad testnet with real market data from multiple categories.
  - Solvency by construction, backed by a fuzz test rather than just a claim.
  - A signed, quorum-based multi-venue oracle with agreement-based settlement.
  - A clean trading UX: skew-aware entry, liquidation estimates, slippage protection, and a house risk dashboard.

  ## What we learned
  - Leverage on a bounded asset takes different math from regular perps: payoff asymmetry near 0¢ and 100¢ matters a lot.
  - Oracles are most of the product. Freshness, agreement between venues, and resolution handling cause far more edge cases than the trading logic.
  - Monad's speed makes frequent oracle updates practical, but every update still has a cost you have to design around.

  ## What's next for Gradience
  - **Decentralize the oracle:** independent signer operators on separate infrastructure, more venues, jump limits and a dispute path.
  - **Harden the contract:** invariant tests with funding and skew enabled, parameter simulation on historical price paths, a multisig and timelock owner, then an external audit.
  - **LP vault:** let users provide liquidity to the house and share its risk and fees.
  - **Indexer and monitoring:** full trade history, house P&L over time, and alerts on stale prices and vault utilization.
  - **Legal groundwork:** leveraged event derivatives are regulated in many places, so we'd get legal advice before any mainnet launch.
