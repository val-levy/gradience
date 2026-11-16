# Local development

Requirements: Node ≥ 20, Foundry (`~/.foundry/bin` — add to PATH), a browser with MetaMask.

## One-time

```bash
npm install
forge build
```

## Run the full local stack

```bash
anvil --silent                                   # chain id 31337 at 127.0.0.1:8545
export RPC_URL=http://127.0.0.1:8545             # ALWAYS set; default is Monad testnet
DEPLOYER_KEY=<anvil account #0 key> SIGNER_ADDRESSES=<addr1>,<addr2> QUORUM=2 HOUSE_DEPOSIT=100 \
  node scripts/deploy.mjs                        # writes scripts/deployment.json + src/config.js
cast send <addr> "createMarket(string,uint64,uint128,uint128,uint128,uint128)" \
  "GEMI-…" <expiryUnix> 0.64ether 500ether 0.05ether 0.1ether --private-key … --rpc-url $RPC_URL
RELAYER_KEY=… SIGNER_KEYS=… SIGNER_VENUES=gemini,gemini node scripts/keeper.mjs
npm run dev                                      # http://localhost:8000
```

Generate throwaway signer keys with `cast wallet new`; keep them in your shell or an untracked file, never in the repo. In MetaMask, add network RPC `http://127.0.0.1:8545`, chain id `31337`, symbol ETH/MON, and import an anvil account.

Anvil restarts wipe state: redeploy and re-list markets (deploy rewrites `src/config.js`; `git checkout src/config.js` before committing).

## Monad testnet

Chain id `10143` (`0x279f`), RPC `https://testnet-rpc.monad.xyz`. Deploy with your own funded key:

```bash
export RPC_URL=https://testnet-rpc.monad.xyz
DEPLOYER_KEY=0x… SIGNER_ADDRESSES=… QUORUM=2 HOUSE_DEPOSIT=100 node scripts/deploy.mjs
```

Commit the generated `src/config.js` only for a real testnet deployment the team will share.

## Tests

- `forge test` — contracts. `forge test --match-test testFuzz -vv` for the fuzz.
- `npm test` — frontend; `tests/app.test.js` runs `src/main.js` in a `vm` context with stubbed DOM; pass a `Chain` stub as the third arg to `createApp`, and use `app.run("…")` to poke top-level bindings.

## Deploy site

`npm run deploy` (Cloudflare Workers static assets, project root; `.assetsignore` excludes contracts/scripts/tests).
