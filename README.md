# Impact Perps

An MVP interface for perpetual markets on impact outcomes, designed for Monad.

## Run locally

```bash
npm install
npm run dev -- 5174
```

This project has no runtime npm dependencies. `5174` is an arbitrary port; choose
another available port if it is already occupied, then open `http://localhost:5174`.

The UI connects MetaMask to Monad Testnet. Trades are staged in the interface only; no transaction is sent until the Impact Perps contract is deployed and integrated.

## Data and execution model

- **Market discovery/data:** the Markets screen loads open binary contracts from Gemini's public Prediction Markets `events` endpoint in 100-event batches. Use “Import next batch” to add more; listings are paginated in the UI for responsiveness.
- **Screens:** Overview, Markets, and Trade are separate views. Choosing a market from the directory opens its trading terminal.
- **Wallet:** MetaMask connects to Monad Testnet (chain ID `10143`). If needed, the app asks MetaMask to add the testnet RPC.
- **Execution:** deliberately separate from Gemini. The current trade action is a demo preview and never broadcasts a transaction.
- **Demo ticker:** the initial impact market moves locally every 1.8 seconds so the demo remains active if the public feed is unavailable.

The demo never sends orders to Gemini and has no deployed contract address yet, so it cannot transfer funds.

## Deploy to Cloudflare Workers

Live site: <https://impact-perps.valentinlevya.workers.dev>

After authenticating Wrangler with your Cloudflare account, run:

```bash
npm run deploy
```

The static site is served from the project root. `.assetsignore` keeps source-only files and the instructional contract out of the public deployment.

## Monad deployment target

The prototype uses standard Solidity because Monad is EVM-compatible.

| Network       | Chain ID | RPC                             |
| ------------- | -------: | ------------------------------- |
| Monad mainnet |    `143` | `https://rpc.monad.xyz`         |
| Monad testnet |  `10143` | `https://testnet-rpc.monad.xyz` |

`contracts/ImpactPerps.sol` is intentionally an instructional prototype, not production-ready financial infrastructure. Before handling funds, use audited ERC-20 collateral handling, a verified decentralized oracle, isolated market vaults, liquidation/ADL mechanics, governance controls, testing, and an external security audit.

## Product decision

Each market expresses the probability of a verifiable impact outcome as a 0–100¢ index. Traders can take a leveraged long on YES or short on NO. An evidence oracle proposes and settles indices from predefined public sources and methodology.
