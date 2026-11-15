// All contract access lives here. Reads use a public RPC (no wallet needed); writes use the user's MetaMask.
// Prices are returned in cents (0–100), MON amounts as plain numbers.
const Chain = (() => {
  const cfg = () => window.PERPS_CONFIG;
  const enabled = () => Boolean(cfg()?.address && window.ethers);
  const cents = (x) => Number(ethers.formatUnits(x, 16));
  const mon = (x) => Number(ethers.formatEther(x));
  let rpc, reader;
  const provider = () => (rpc ??= new ethers.JsonRpcProvider(cfg().rpcUrl, Number(cfg().chainId), { staticNetwork: true }));
  const read = () => (reader ??= new ethers.Contract(cfg().address, cfg().abi, provider()));
  const write = async (walletProvider) =>
    new ethers.Contract(cfg().address, cfg().abi, await new ethers.BrowserProvider(walletProvider).getSigner());

  // RPCs cap eth_getLogs ranges, so walk backwards in chunks and shrink on error.
  // ponytail: scans only the last `lookback` blocks; swap for an indexer (Goldsky/Envio) when history matters.
  async function logs(filter, lookback) {
    const latest = await provider().getBlockNumber();
    const floor = Math.max(cfg().deployBlock ?? 0, latest - lookback);
    const out = [];
    let step = 5000;
    for (let to = latest; to >= floor; ) {
      const from = Math.max(floor, to - step + 1);
      try {
        out.push(...(await provider().getLogs({ ...filter, fromBlock: from, toBlock: to })));
        to = from - 1;
      } catch (error) {
        if (step <= 100) throw error;
        step = Math.max(100, Math.floor(step / 4));
      }
    }
    return out.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
  }

  const market = (idx, m, markPx) => ({
    idx,
    name: m.name,
    expiry: Number(m.expiry),
    priceTime: Number(m.priceTime),
    settled: m.settled,
    index: cents(m.indexPrice),
    mark: cents(markPx),
    settlePrice: cents(m.settlePrice),
    longOI: mon(m.longOI),
    shortOI: mon(m.shortOI),
    oiCap: mon(m.oiCap),
    skew: cents(m.skewFactor) / 100, // price units at full cap (0.05 = 5c)
    funding: mon(m.fundingPerDay), // fraction/day at full skew
  });

  const position = (id, p, h) => ({
    id: Number(id),
    trader: p.trader,
    marketIdx: Number(p.marketId),
    isLong: p.isLong,
    open: p.open,
    collateral: mon(p.collateral),
    notional: mon(p.notional),
    entry: cents(p.entryPrice),
    maxProfit: mon(p.maxProfit),
    pnl: mon(h.pnl),
    funding: mon(h.funding),
    equity: mon(h.equity),
    liquidatable: h.liquidatable,
  });

  return {
    enabled,
    config: cfg,
    async loadMarkets() {
      const c = read();
      const n = Number(await c.marketCount());
      return Promise.all(
        Array.from({ length: n }, async (_, i) => market(i, await c.markets(i), await c.markPrice(i))),
      );
    },
    async loadPositions(ids) {
      const c = read();
      return Promise.all(
        ids.map(async (id) => position(id, await c.positions(id), await c.positionHealth(id))),
      );
    },
    async userPositions(address) {
      const ids = await read().userPositionIds(address);
      return (await this.loadPositions(ids)).reverse();
    },
    async allPositions() {
      const n = Number(await read().positionCount());
      return (await this.loadPositions(Array.from({ length: n }, (_, i) => i))).reverse();
    },
    async house() {
      const c = read();
      const [owner, houseBalance, reserved, netDeposited, contractBalance, quorum, signerCount, feeBps, maintBps, maxLeverage, maxStale] =
        await Promise.all([
          c.owner(), c.houseBalance(), c.reserved(), c.netDeposited(), provider().getBalance(cfg().address),
          c.quorum(), c.signerCount(), c.feeBps(), c.maintBps(), c.maxLeverage(), c.maxStale(),
        ]);
      return {
        owner,
        houseBalance: mon(houseBalance),
        reserved: mon(reserved),
        free: mon(houseBalance - reserved),
        realizedPnl: mon(houseBalance - netDeposited), // fees + trader losses − trader wins, net of deposits
        contractBalance: mon(contractBalance),
        quorum: Number(quorum),
        signerCount: Number(signerCount),
        feeBps: Number(feeBps),
        maintBps: Number(maintBps),
        maxLeverage: Number(maxLeverage),
        maxStale: Number(maxStale),
      };
    },
    async balance(address) {
      return mon(await provider().getBalance(address));
    },
    async priceHistory(idx) {
      const c = read();
      const found = await logs(c.filters.PriceUpdated(idx), 200_000);
      return found.map((l) => ({ t: l.blockNumber, price: cents(c.interface.parseLog(l).args.price) }));
    },
    async feed() {
      const c = read();
      const [opened, closed] = await Promise.all([
        logs(c.filters.PositionOpened(), 50_000),
        logs(c.filters.PositionClosed(), 50_000),
      ]);
      const rows = [
        ...opened.map((l) => ({ kind: "open", block: l.blockNumber, ...c.interface.parseLog(l).args.toObject() })),
        ...closed.map((l) => ({ kind: "close", block: l.blockNumber, ...c.interface.parseLog(l).args.toObject() })),
      ];
      return rows.sort((a, b) => b.block - a.block).slice(0, 40);
    },
    // writes — each returns the tx hash after the tx is mined
    async open(wallet, idx, isLong, leverage, amountMon) {
      const tx = await (await write(wallet)).openPosition(idx, isLong, leverage, { value: ethers.parseEther(String(amountMon)) });
      await tx.wait();
      return tx.hash;
    },
    async close(wallet, id) {
      const tx = await (await write(wallet)).closePosition(id);
      await tx.wait();
      return tx.hash;
    },
    async liquidate(wallet, id) {
      const tx = await (await write(wallet)).liquidate(id);
      await tx.wait();
      return tx.hash;
    },
    async deposit(wallet, amountMon) {
      const tx = await (await write(wallet)).depositHouse({ value: ethers.parseEther(String(amountMon)) });
      await tx.wait();
      return tx.hash;
    },
    async withdraw(wallet, amountMon) {
      const tx = await (await write(wallet)).withdrawHouse(ethers.parseEther(String(amountMon)));
      await tx.wait();
      return tx.hash;
    },
    async createMarket(wallet, { name, expiry, price, oiCap, skew, funding }) {
      const tx = await (await write(wallet)).createMarket(
        name, expiry, ethers.parseUnits(price.toFixed(6), 18), ethers.parseEther(String(oiCap)),
        ethers.parseUnits(String(skew), 18), ethers.parseUnits(String(funding), 18),
      );
      await tx.wait();
      return tx.hash;
    },
    errorText(error) {
      return error?.reason || error?.shortMessage || error?.info?.error?.message || error?.message || "Transaction failed.";
    },
  };
})();
