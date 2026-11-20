# Gradience — hackathon submission

<!-- Before submitting:
  - Keep only real sponsors of this event in "Technologies / sponsor tools".
  - Replace the Inspiration section with the team's own story.
  - Add links: GitHub repo (push first), live site, Monad testnet explorer page for the contract (check it loads).
-->

## Short description

Gradience lets you go long or short a prediction-market probability with up to 25× leverage on Monad. Prices come from a signed oracle, and markets settle when the real-world event resolves.

## What did you build?

A perpetual futures exchange for prediction markets, live on Monad testnet. Traders pick a real outcome, such as an NFL game, a Champions League spread, a crypto price or tomorrow's weather. They go long or short its probability (0–100¢) with MON as margin, and can close at any time without waiting for the event. Markets settle at exactly 0¢ or 100¢ once the event resolves; during testing, one of our NBA markets settled live.

## What problem does it solve?

Prediction markets are all-or-nothing: you buy shares and usually hold until resolution. You can't lever up on a conviction, cheaply short an overpriced probability, or trade the move from 40¢ to 60¢. Crypto solved this for assets with perpetual futures; Gradience brings that to probabilities.

## How does it work?

- **Smart contract:** a Solidity contract holds markets, positions and a house vault that takes the other side of every trade. When a position opens, the vault reserves its maximum possible payout, so it can always pay winners. A fuzz test checks this solvency guarantee.
- **Oracle:** a keeper fetches live prices from Gemini's prediction markets and has independent keys sign them (EIP-712). The contract requires a quorum of signatures, takes the median, and rejects stale or replayed prices. It settles a market only when every quoting venue agrees on the result.
- **Trading:** the order ticket shows the entry price including open-interest skew, a liquidation estimate and a slippage limit. Positions accrue funding, and anyone can liquidate an underwater one for a reward.
- **Frontend:** a static web app talking to the contract directly through MetaMask, with Markets, Trade, My Positions and a House risk dashboard.

## What makes it unique?

- **Leverage on a bounded asset.** Probabilities are capped at 0 and 100¢, so long and short payoffs aren't symmetric. We reserve each position's exact maximum payout and clamp losses to margin, which makes the house solvent by construction.
- **Settlement from the venue's own resolution,** so no one has to judge outcomes manually.
- **A quorum-signed, multi-venue oracle,** so new price sources or operators can be added without changing the contract.
- **Any listed outcome becomes a leveraged market:** sports, crypto, weather.

## What would you build next?

- Independent oracle operators and more venues. Polymarket is already supported in the keeper, but our demo uses Gemini only.
- An LP vault, so users can fund the house and share its fees and risk.
- Contract hardening: invariant tests with funding and skew enabled, a multisig owner, then an external audit.
- An indexer for full trade history, and monitoring for oracle freshness and vault utilization.
- Legal groundwork before anything beyond testnet.

## Technologies / sponsor tools

- **Monad testnet:** the chain, with native MON margin.
- **Solidity and Foundry:** the contract and its 13 tests, including the solvency fuzz test.
- **ethers.js v6 and Node.js:** the keeper and deploy scripts.
- **EIP-712:** signed oracle prices.
- **Gemini prediction-markets API:** live prices, market data and resolutions.
- **Polymarket API:** supported in the oracle, not used in the demo.
- **MetaMask:** wallet and transaction signing.
- **Cloudflare Workers:** hosting, with a scheduled-job version of the keeper in the repo.
- **Claude Code:** development assistant.

## Smart contract / program addresses

```
PredictionPerps (Gradience): 0x981858b70D80Cb5b456c789f1609efdcb135551E
Network: Monad Testnet (chain ID 10143)
Holds markets, positions, the house vault, liquidations, funding, and EIP-712 signed-oracle price updates and settlement.
```

## Technical summary

**Architecture.** A Solidity contract on Monad testnet (`PredictionPerps`, 0x981858b70D80Cb5b456c789f1609efdcb135551E), a Node.js oracle keeper, and a static web frontend that talks to the contract through MetaMask.

**Contract.** Traders post MON margin and go long or short a market's probability (0–1) with up to 25× leverage. A house vault is the counterparty. At open, each position's maximum profit is reserved from the vault and losses are capped at margin, so the house is solvent by construction. Entry = oracle index + open-interest skew impact, with a slippage limit on every open. The contract also handles funding, permissionless liquidation, and settlement at exactly 0 or 1 when the event resolves.

**Oracle.** The keeper pulls Gemini prediction-market prices (Polymarket supported) and signs them with EIP-712. The contract requires a quorum of signers, takes the median, and rejects stale or replayed updates. It settles only when every quoting venue agrees. A live NBA market resolved and settled on-chain automatically during our testing.

**Frontend.** Vanilla JS with ethers v6: markets, a trade ticket whose entry and liquidation math mirrors the contract, live P&L, and a House dashboard showing vault, open interest and if-YES / if-NO scenarios.

**Testing.** 13 Foundry tests, including a fuzz test that the house stays solvent, plus 6 frontend tests.

**Limitations.** Testnet only and unaudited. The demo keeper holds all signer keys in one process.

---

# Project story (Devpost)

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
