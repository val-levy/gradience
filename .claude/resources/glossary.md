# Glossary

- **Perp** — perpetual-style leveraged position with no fixed maturity (here it ends at settlement or expiry grace).
- **YES / NO** — the outcome sides. Long = long YES price; Short = short YES (equivalent to long NO).
- **Index price** — oracle median (0–100¢). **Mark price** — index plus skew impact at current net OI. **Entry** — index plus impact including the new trade.
- **Notional** — collateral × leverage. **OI** — open interest (sum of notionals), long and short separately; **oiCap** limits each side and net.
- **Skew** — long OI minus short OI. **Skew factor** — price impact at full cap. **Funding** — heavy side pays the light side over time.
- **House / vault** — pool of MON that takes the other side of every trade. **Reserved** — house funds locked to cover max profit on open positions. **Free liquidity** — house balance minus reserved.
- **Maintenance margin** — equity floor (1% of notional) below which a position is liquidatable. **Liquidation reward** — paid to the caller.
- **Slippage limit** — worst entry price the trader accepts (`limitPrice`).
- **Keeper** — off-chain process fetching prices, signing and relaying. **Signer** — key allowed to sign price updates. **Quorum** — min signatures needed.
- **Finalized update** — oracle message that settles a market at 0 or 1.
- **Grace exit** — fail-safe close 7 days after expiry if no settlement arrived.
- **Gemini instrument symbol** — contract id like `GEMI-BTC2611202200-HI63000` (event ticker + threshold).
- **Monad testnet** — EVM chain, id 10143, native token MON.
