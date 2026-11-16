// Oracle keeper (local process). Logic lives in keeper-core.mjs; the hosted version is worker/oracle.mjs.
// Usage: RELAYER_KEY=0x… SIGNER_KEYS=0xk1,0xk2,0xk3 SIGNER_VENUES=gemini,polymarket,gemini node scripts/keeper.mjs [--once]
// ponytail: one process holds all signer keys for convenience. For real trust-minimisation run one keeper per signer on separate infra.
import { readFileSync, existsSync } from "node:fs";
import { artifact, deployment, need, provider } from "./lib.mjs";
import { createKeeper } from "./keeper-core.mjs";

const INTERVAL = Number(process.env.INTERVAL_MS || 15000);
// optional overrides: { "<on-chain market name>": { "gemini": "GEMI-…", "polymarket": "<conditionId>" } }
const mapFile = new URL("./keeper.markets.json", import.meta.url);
const mapping = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, "utf8")) : {};

const d = deployment();
const venues = need("SIGNER_VENUES").split(",").map((v) => v.trim());
const { relayer, signers, cycle } = createKeeper({
  address: d.address, chainId: d.chainId, abi: artifact().abi, provider: provider(),
  relayerKey: need("RELAYER_KEY"), signerKeys: need("SIGNER_KEYS").split(",").map((k) => k.trim()), venues, mapping,
});

console.log(`Keeper → ${d.address} (relayer ${relayer.address}, ${signers.length} signers: ${signers.map((k, i) => `${venues[i]}:${k.address.slice(0, 8)}`).join(" ")})`);
do {
  try { await cycle(); } catch (e) { console.warn("cycle error:", e.shortMessage || e.message); }
  if (process.argv.includes("--once")) break;
  await new Promise((r) => setTimeout(r, INTERVAL));
} while (true);
