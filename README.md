# Impact Perps — perps on prediction markets (Monad)

Leveraged long/short on the probability (0–100¢) of a prediction-market outcome. Margin is MON. A house vault is the counterparty; prices come from a signed multi-venue oracle (Gemini + Polymarket); markets settle at exactly 0¢ or 100¢ when the venue resolves.

**Status: testnet only, unaudited.**

## Architecture

| Piece | Where | What it does |
| --- | --- | --- |
| Contract | `contracts/PredictionPerps.sol` | Markets, positions, house vault, liquidations, funding, OI-skew price impact, EIP-712 oracle, settlement |
| Tests | `test/PredictionPerps.t.sol` | 13 Foundry tests incl. a solvency fuzz (`forge test`) |
| Deploy | `scripts/deploy.mjs` | Deploys, sets signers/quorum, funds the house, writes `src/config.js` |
| Keeper | `scripts/keeper.mjs` | Fetches Gemini/Polymarket prices, signs, relays `updatePrice` |
| Frontend | `index.html`, `src/*.js` | Markets, Trade, My positions, House dashboard (static, ethers v6) |

**Mechanics.** Long PnL = notional·(px−entry)/entry; short PnL = notional·(entry−px)/(1−entry). Max profit is reserved from the house at open, so the vault can always pay. Entry = index + skewFactor·netOI/oiCap (both skew and funding default to 0). Leverage ≤ 25×, maintenance margin 1%, fee 0.05%/side, entries only between 3¢ and 97¢. `openPosition` takes a `limitPrice` (slippage guard; the UI uses ±0.5¢). Expired markets allow a fail-safe exit 7 days after expiry. Failed payouts go to `claimable`.

**Oracle.** Each signer key quotes one venue. `updatePrice` needs `quorum` signatures (sorted by signer address), takes the median, requires a newer timestamp, and rejects stale data. A `finalized` update settles the market at 0 or 1; the keeper only finalizes when every quoting venue reports the same resolution.

## Run locally

```bash
npm install
npm run dev            # http://localhost:8000
npm test               # frontend tests
forge test             # contract tests
```

Without a deployment (`src/config.js` is a stub) the app shows Gemini markets as reference data only.

## Deploy to Monad testnet

You run these with your own funded testnet key (never paste keys into chat or commit them):

```bash
forge build
export RPC_URL=https://testnet-rpc.monad.xyz
export DEPLOYER_KEY=0x…                 # funded with testnet MON; becomes owner
export SIGNER_ADDRESSES=0xA…,0xB…       # oracle signer addresses
QUORUM=2 HOUSE_DEPOSIT=100 node scripts/deploy.mjs

RELAYER_KEY=0x… SIGNER_KEYS=0xk1,0xk2 SIGNER_VENUES=gemini,polymarket node scripts/keeper.mjs
```

Then open the app as the owner wallet, pick a Gemini market on the Trade screen and press **List this market on-chain** (defaults: 500 MON OI cap, 5¢ skew, 10%/day funding). Add the venue ids for it to `scripts/keeper.markets.json` (`{ "<market name>": { "gemini": "GEMI-…", "polymarket": "<conditionId>" } }`) so the keeper quotes it. Local testing works the same against `anvil` with `RPC_URL=http://127.0.0.1:8545`.

`scripts/deploy.mjs` overwrites `src/config.js` with the address and ABI; commit that file only for a real testnet deployment, not a local one.

## Deploy the site (Cloudflare Workers)

```bash
npm run deploy
```

`.assetsignore` keeps contracts, scripts and tests out of the public bundle.

## Screens

- **Markets** — on-chain perps (top) and Gemini reference contracts; Gemini rows disappear once listed.
- **Trade** — chart from oracle updates, MON ticket with skew-aware entry and liquidation estimate.
- **My positions** — your open positions, PnL, funding, close buttons.
- **House** (owner nav link; read-only for others) — vault, reserved, realized P&L, per-market OI and settle-YES/NO scenarios, every position with Liquidate buttons, recent trades, deposit/withdraw.

## Known limits

- All oracle signer keys can run in one keeper process; for real trust-minimisation run one signer per party.
- Funding/skew parameters are untuned; the contract is unaudited and only for testnet.
- History is read with `eth_getLogs` over a bounded lookback (200k blocks prices, 50k blocks trades) because RPCs cap ranges; use an indexer for full history.
- The "move" shown for on-chain markets is change since the first oracle update in the lookback window, not a true 24h change.
- Deposits are the native token (MON); there is no ERC-20 collateral.
