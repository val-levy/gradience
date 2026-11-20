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
