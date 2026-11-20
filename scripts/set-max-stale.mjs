// Change the oracle staleness window (owner only), keeping the other setParams values as they are.
// Usage: MAX_STALE=1800 node --env-file=.env scripts/set-max-stale.mjs   (seconds; needs DEPLOYER_KEY = owner)
// Longer windows tolerate a flaky keeper but let trades fill at older prices — fine for a demo, not for real funds.
import { ethers } from "ethers";
import { artifact, deployment, need, provider } from "./lib.mjs";

const stale = BigInt(need("MAX_STALE"));
const d = deployment();
const perps = new ethers.Contract(d.address, artifact().abi, new ethers.Wallet(need("DEPLOYER_KEY"), provider()));
const [fee, maint, liq, lev, old] = await Promise.all(
  ["feeBps", "maintBps", "liqRewardBps", "maxLeverage", "maxStale"].map((f) => perps[f]()),
);
console.log(`maxStale ${old}s → ${stale}s on ${d.address}`);
await (await perps.setParams(fee, maint, liq, lev, stale)).wait();
console.log(`done: maxStale is now ${await perps.maxStale()}s`);
