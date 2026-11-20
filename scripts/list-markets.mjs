// Bulk-list Gemini contracts on-chain (owner only). Picks one contract per event (the one nearest 50¢) from the
// highest-24h-volume events, priced 15–85¢, unresolved, expiring in >= MIN_DAYS. Same params as the UI's list button.
// Usage: RPC_URL=… [DEPLOYER_KEY=0x…] COUNT=8 [MIN_DAYS=3] [SYMBOLS=GEMI-…,GEMI-…] node scripts/list-markets.mjs [--dry]
// SYMBOLS lists exactly those contracts (still subject to the price/expiry filters) instead of the top-volume picks.
// --dry prints the plan and needs no key.
import { ethers } from "ethers";
import { artifact, deployment, need, provider } from "./lib.mjs";

const COUNT = Number(process.env.COUNT || 8);
const MIN_DAYS = Number(process.env.MIN_DAYS || 3);
const dry = process.argv.includes("--dry");
const d = deployment();
const perps = new ethers.Contract(d.address, artifact().abi, dry ? provider() : new ethers.Wallet(need("DEPLOYER_KEY"), provider()));

const r = await fetch("https://api.gemini.com/v1/prediction-markets/events?limit=500", { signal: AbortSignal.timeout(20000) });
if (!r.ok) throw Error(`Gemini → HTTP ${r.status}`);
const events = (await r.json()).data;

const listed = new Set();
for (let i = 0, n = Number(await perps.marketCount()); i < n; i++) listed.add((await perps.markets(i)).name);

const minExpiry = Date.now() / 1000 + MIN_DAYS * 86400;
const mid = (c) => {
  const { bestBid, bestAsk, lastTradePrice } = c.prices || {};
  const bid = Number(bestBid), ask = Number(bestAsk);
  return bid > 0 && ask > 0 && ask - bid <= 0.1 ? (bid + ask) / 2 : Number(lastTradePrice);
};
// ALL=1: every qualifying contract of every event; otherwise one per event (nearest 50¢), COUNT events.
const all = process.env.ALL === "1";
const only = process.env.SYMBOLS ? new Set(process.env.SYMBOLS.split(",").map((s) => s.trim())) : null;
const RESERVE = ethers.parseEther(process.env.RESERVE_MON || "2"); // keep gas for the oracle relayer (same wallet)
const picks = events
  .filter((e) => e.status === "active")
  .sort((a, b) => Number(b.volume24h ?? 0) - Number(a.volume24h ?? 0))
  .flatMap((e) => {
    const ok = (e.contracts || [])
      .map((c) => ({ c, price: mid(c), expiry: Math.floor(Date.parse(c.expiryDate || e.expiryDate) / 1000) }))
      .filter(({ c, price, expiry }) => c.marketState === "open" && !c.resolutionSide && !listed.has(c.instrumentSymbol)
        && (!only || only.has(c.instrumentSymbol))
        && price >= 0.15 && price <= 0.85 && expiry >= minExpiry)
      .sort((a, b) => Math.abs(a.price - 0.5) - Math.abs(b.price - 0.5));
    return (all || only ? ok : ok.slice(0, 1)).map(({ c, price, expiry }) => ({ name: c.instrumentSymbol, label: `${e.title} — ${c.label}`, price, expiry }));
  })
  .slice(0, all || only ? Infinity : COUNT);

console.log(`${picks.length} to list (${listed.size} already on-chain), contract ${d.address}`);
let done = 0;
for (const m of picks) {
  if (!dry && (await perps.runner.provider.getBalance(perps.runner.address)) < RESERVE) {
    console.log(`Stopping: balance below ${ethers.formatEther(RESERVE)} MON reserve after ${done} listings.`);
    break;
  }
  console.log(`${dry ? "would list" : "listing"} ${m.name}  ${(m.price * 100).toFixed(1)}¢  ${new Date(m.expiry * 1000).toISOString().slice(0, 10)}  ${m.label}`);
  if (dry) continue;
  try {
    const tx = await perps.createMarket(m.name, m.expiry, ethers.parseUnits(m.price.toFixed(6), 18), ethers.parseEther("500"),
      ethers.parseUnits("0.05", 18), ethers.parseUnits("0.1", 18));
    await tx.wait();
    done++;
  } catch (e) { console.warn(`  failed: ${e.shortMessage || e.message}`); }
}
