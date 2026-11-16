# Contract — `contracts/PredictionPerps.sol`

Solidity 0.8.24, Foundry, `via_ir = true` (needed to avoid stack-too-deep). Native MON as margin; no ERC-20.

## Model

- Price `p` in 1e18 (1e18 = 100¢). A position has `entry`, `notional = collateral × leverage`, `isLong`.
- Long PnL = notional·(p−entry)/entry. Short PnL = notional·(entry−p)/(1−entry).
- `maxProfit` (long: notional·(1−entry)/entry; short: notional·entry/(1−entry)) is **reserved from the house at open**. Invariant: `houseBalance ≥ reserved`.
- `netDeposited` tracks owner deposits/withdrawals, so realized house P&L = `houseBalance − netDeposited`.
- Fee 5 bps/side on notional; maintenance margin 1%; liquidation reward 0.5%; max leverage 25×; entries only between 3¢ and 97¢.
- **Skew impact:** `mark = index + skewFactor × netOI / oiCap`. Entry uses net OI *after* the new trade. Default skew 0.
- **Funding:** heavy side pays `fundingPerDay × skew-ratio` via `cumFunding`. Default 0.
- **Settlement:** a finalized oracle update sets `settled`, `settlePrice` ∈ {0, 1e18}; anyone can close positions after. Market closed to new trades.
- **Grace exit:** 7 days past expiry without settlement, anyone may close at the last index.
- Failed ETH sends go to `claimable[addr]`, pulled with `claim()`.

## API

```
createMarket(name, expiry, initialPrice, oiCap, skewFactor, fundingPerDay)   owner
setMarketParams(id, oiCap, skewFactor, fundingPerDay)                        owner
setSigner(addr, bool) / setQuorum(n) / setParams(fee, maint, liqReward, maxLev, stale)   owner
depositHouse() payable / withdrawHouse(amount)                               owner (withdraw ≤ free)
updatePrice(id, SignedPrice[])                                               anyone (relayer)
openPosition(id, isLong, leverage, limitPrice) payable                       trader; limit: long ≤, short ≥
closePosition(id) / liquidate(id) / claim()
views: marketCount, positionCount, userPositionIds, markPrice, positionHealth(id) → (pnl, funding, equity, liquidatable)
events: MarketCreated, PriceUpdated, MarketSettled, PositionOpened, PositionClosed(reason 0 close/1 liq/2 settled), HouseDeposit, HouseWithdraw
```

Market struct order: name, expiry, priceTime, settled, indexPrice, settlePrice, longOI, shortOI, oiCap, skewFactor, fundingPerDay, fundingTime, cumFunding. Position: trader, marketId, isLong, open, collateral, notional, entryPrice, maxProfit, fundingEntry.

## Oracle

EIP-712 domain `PredictionPerps` v`1`. Type `PriceUpdate(uint256 marketId,uint256 price,uint256 timestamp,bool finalized)`. Signatures must be sorted by ascending signer address (no duplicates), ≥ `quorum`, median taken, timestamp must exceed `priceTime`, `maxStale` enforced on opens.

## Tests (`test/PredictionPerps.t.sol`)

No forge-std; a local `Vm` interface declares the cheatcodes used. Covers profit both sides, liquidation, settlement, oracle quorum/replay, edge price, house capacity, skew/funding, grace exit, withdraw-vs-reserve, slippage, and a fuzz price walk asserting solvency.

## Gotchas

- Tuple destructuring in tests must match the exact field count (13 for markets, 9 for positions).
- Test contract needs a `receive()`; it is the owner/house.
- Unaudited. Wanted next: invariant tests with funding/skew on, owner multisig + timelock, pause switch.
