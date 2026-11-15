// Usage: DEPLOYER_KEY=0x… SIGNER_ADDRESSES=0xA,0xB,0xC QUORUM=2 HOUSE_DEPOSIT=100 node scripts/deploy.mjs
// Writes scripts/deployment.json (keeper) and src/config.js (frontend). Run `forge build` first.
import { writeFileSync } from "node:fs";
import { ethers } from "ethers";
import { RPC, artifact, need, provider } from "./lib.mjs";

const p = provider();
const wallet = new ethers.Wallet(need("DEPLOYER_KEY"), p);
const { abi, bytecode } = artifact();
const signers = need("SIGNER_ADDRESSES").split(",").map((s) => s.trim());
const quorum = Number(process.env.QUORUM || Math.min(2, signers.length));

const net = await p.getNetwork();
console.log(`Deploying from ${wallet.address} to chain ${net.chainId} (${RPC})`);
const c = await new ethers.ContractFactory(abi, bytecode.object, wallet).deploy();
const receipt = await c.deploymentTransaction().wait();
const address = await c.getAddress();
for (const s of signers) await (await c.setSigner(s, true)).wait();
await (await c.setQuorum(quorum)).wait();
if (process.env.HOUSE_DEPOSIT)
  await (await c.depositHouse({ value: ethers.parseEther(process.env.HOUSE_DEPOSIT) })).wait();

const info = { address, chainId: Number(net.chainId), deployBlock: receipt.blockNumber, rpcUrl: RPC, owner: wallet.address };
writeFileSync(new URL("./deployment.json", import.meta.url), JSON.stringify(info, null, 2));
writeFileSync(
  new URL("../src/config.js", import.meta.url),
  `window.PERPS_CONFIG = ${JSON.stringify({ ...info, abi }, null, 2)};\n`,
);
console.log("Deployed", address, "— wrote scripts/deployment.json and src/config.js");
