# Hackathon playbook

## Demo script (≈3 min)
1. Markets screen: on-chain perps with live prices from signed Gemini quotes.
2. Connect MetaMask (Monad testnet), open a 5× long on a market; show entry, liquidation estimate and the slippage-protected tx.
3. My positions: live PnL; close it.
4. House dashboard: vault, reserved, per-market OI, "if YES / if NO" house P&L scenarios, liquidate an underwater position.
5. Settlement: a market resolving YES/NO and positions paying out at 0/100¢.

Have a seeded market and a funded wallet ready; do not rely on a live resolution happening during the demo.

## Pitch points
- Leverage on any prediction market outcome, settled by the venue's own resolution.
- Solvency by construction: max profit reserved at open.
- Oracle is multi-venue, signed, quorum-based; swap in more operators without a contract change.

## Be upfront about
Testnet, unaudited, single-process oracle signers, untuned funding/skew, bounded history. See `production-roadmap.md`.

## Task claiming
Pick an area from `CLAUDE.md`, claim it in the team chat, keep commits modular, run `forge test` and `npm test` before pushing.
