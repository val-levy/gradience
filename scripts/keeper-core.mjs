// Oracle keeper core, shared by the local process (keeper.mjs) and the Cloudflare cron Worker (worker/oracle.mjs).
// No node:fs here: the Worker bundles this. Each signer key quotes ONE venue (gemini | polymarket);
// the contract takes the median of >= quorum signatures.
import { ethers } from "ethers";

const GEMINI = "https://api.gemini.com/v1/prediction-markets/events";
const POLY = "https://gamma-api.polymarket.com/markets";
const ONE = 10n ** 18n;
const types = {
  PriceUpdate: [
    { name: "marketId", type: "uint256" }, { name: "price", type: "uint256" },
    { name: "timestamp", type: "uint256" }, { name: "finalized", type: "bool" },
  ],
};

const getJSON = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw Error(`${url} → HTTP ${r.status}`);
  return r.json();
};

/** → { price: 0..1, resolved: "yes" | "no" | null } */
const quote = {
  async gemini(symbol) {
    // GEMI-<eventTicker>-<contractTicker>; event tickers can contain dashes (NBA-2611200100-LAC-SAS-T), contract tickers don't
    const eventTicker = symbol.slice(5, symbol.lastIndexOf("-"));
    const ev = await getJSON(`${GEMINI}/${eventTicker}`);
    const c = (ev.contracts || []).find((x) => x.instrumentSymbol === symbol);
    if (!c) throw Error(`no Gemini contract ${symbol}`);
    if (c.resolutionSide) return { price: c.resolutionSide === "yes" ? 1 : 0, resolved: c.resolutionSide };
    const { bestBid, bestAsk, lastTradePrice } = c.prices || {};
    const bid = Number(bestBid), ask = Number(bestAsk), last = Number(lastTradePrice);
    // mid when the book is tight, else last trade (a wide book's mid is noise)
    const price = bid > 0 && ask > 0 && ask - bid <= 0.1 ? (bid + ask) / 2 : last;
    if (!(price > 0 && price < 1)) throw Error(`bad Gemini price ${price}`);
    return { price, resolved: null };
  },
  async polymarket(conditionId) {
    const [m] = await getJSON(`${POLY}?condition_ids=${conditionId}`);
    if (!m) throw Error(`no Polymarket market ${conditionId}`);
    const outcomes = JSON.parse(m.outcomes), prices = JSON.parse(m.outcomePrices).map(Number);
    const yes = prices[outcomes.indexOf("Yes")];
    if (m.closed && (yes === 1 || yes === 0)) return { price: yes, resolved: yes === 1 ? "yes" : "no" };
    if (!(yes > 0 && yes < 1)) throw Error(`bad Polymarket price ${yes}`);
    return { price: yes, resolved: null };
  },
};

const toWei = (x) => ethers.parseUnits(Math.min(0.999, Math.max(0.001, x)).toFixed(6), 18);

/** mapping: optional { "<on-chain market name>": { gemini, polymarket } } overrides.
 *  → { relayer, signers: Wallet[], cycle(): Promise<void> } */
export function createKeeper({ address, chainId, abi, provider, relayerKey, signerKeys, venues, mapping = {} }) {
  if (signerKeys.length !== venues.length) throw Error("SIGNER_KEYS and SIGNER_VENUES must have the same length");
  const relayer = new ethers.Wallet(relayerKey, provider);
  const signers = signerKeys.map((k) => new ethers.Wallet(k));
  const perps = new ethers.Contract(address, abi, relayer);
  const domain = { name: "PredictionPerps", version: "1", chainId, verifyingContract: address };

  async function cycle() {
    const count = Number(await perps.marketCount());
    const block = await provider.getBlock("latest");
    for (let id = 0; id < count; id++) {
      const m = await perps.markets(id);
      if (m.settled) continue;
      const name = m.name;
      const ref = mapping[name] ?? (name.startsWith("GEMI-") ? { gemini: name } : {});
      const quotes = [];
      for (let i = 0; i < signers.length; i++) {
        const id_ = ref[venues[i]];
        if (!id_) continue;
        try { quotes.push({ key: signers[i], ...(await quote[venues[i]](id_)) }); }
        catch (e) { console.warn(`[${name}] ${venues[i]}: ${e.message}`); }
      }
      const need_ = Number(await perps.quorum());
      if (quotes.length < need_) { console.warn(`[${name}] ${quotes.length}/${need_} quotes — skipping`); continue; }

      // Only finalize if every quoting venue reports the same resolution; mixed/partial → keep trading at last prices.
      const sides = new Set(quotes.map((q) => q.resolved));
      const finalized = sides.size === 1 && !sides.has(null);
      const ts = Math.max(block.timestamp, Number(m.priceTime) + 1); // must be strictly newer than the last accepted update
      const age = block.timestamp - Number(m.priceTime);
      const median = quotes.map((q) => q.price).sort((a, b) => a - b)[Math.floor(quotes.length / 2)];
      const moved = Math.abs(median - Number(m.indexPrice) / 1e18) >= 0.005;
      if (!finalized && !moved && age < 60) continue; // no change, still fresh

      const ups = [];
      for (const q of quotes) {
        const price = finalized ? (q.resolved === "yes" ? ONE : 0n) : toWei(q.price);
        const value = { marketId: id, price, timestamp: ts, finalized };
        ups.push({ addr: q.key.address, price, timestamp: ts, finalized, sig: await q.key.signTypedData(domain, types, value) });
      }
      ups.sort((a, b) => (BigInt(a.addr) < BigInt(b.addr) ? -1 : 1)); // contract needs ascending signer order
      try {
        const tx = await perps.updatePrice(id, ups.map(({ price, timestamp, finalized, sig }) => [price, timestamp, finalized, sig]));
        await tx.wait();
        console.log(`[${name}] ${finalized ? "SETTLED " + quotes[0].resolved : "price " + median.toFixed(3)} (${quotes.length} signers) tx ${tx.hash}`);
      } catch (e) { console.warn(`[${name}] update failed: ${e.shortMessage || e.message}`); }
    }
  }
  return { relayer, signers, cycle };
}
