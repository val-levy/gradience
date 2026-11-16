// Hosted oracle keeper: a Cloudflare cron Worker that runs one keeper cycle per trigger (every minute).
// Secrets (set with `wrangler secret put`): RELAYER_KEY, SIGNER_KEYS (comma-separated), SIGNER_VENUES (comma-separated).
// Contract address/chain come from scripts/deployment.json at build time.
import { ethers } from "ethers";
import artifact from "../out/PredictionPerps.sol/PredictionPerps.json";
import deployment from "../scripts/deployment.json";
import { createKeeper } from "../scripts/keeper-core.mjs";

async function run(env) {
  for (const k of ["RELAYER_KEY", "SIGNER_KEYS", "SIGNER_VENUES"]) if (!env[k]) throw Error(`secret ${k} is not set`);
  const { cycle } = createKeeper({
    address: deployment.address,
    chainId: deployment.chainId,
    abi: artifact.abi,
    provider: new ethers.JsonRpcProvider(deployment.rpcUrl, deployment.chainId, { staticNetwork: true }),
    relayerKey: env.RELAYER_KEY,
    signerKeys: env.SIGNER_KEYS.split(",").map((s) => s.trim()),
    venues: env.SIGNER_VENUES.split(",").map((s) => s.trim()),
  });
  await cycle();
}

export default {
  // Static assets are served before this runs; this only answers paths that don't exist.
  fetch: () => new Response("Not found", { status: 404 }),
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env).catch((e) => console.error("oracle cycle failed:", e.shortMessage || e.message)));
  },
};
