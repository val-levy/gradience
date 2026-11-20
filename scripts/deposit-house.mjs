// Deposit MON into the house vault (owner only) so traders can open bigger positions.
// Usage: AMOUNT=15 node --env-file=.env scripts/deposit-house.mjs   (MON; needs DEPLOYER_KEY = owner)
// Keep enough MON in the wallet for the keeper's gas if it is also the relayer.
import { ethers } from "ethers";
import { artifact, deployment, need, provider } from "./lib.mjs";

const amount = ethers.parseEther(need("AMOUNT"));
const d = deployment();
const wallet = new ethers.Wallet(need("DEPLOYER_KEY"), provider());
const perps = new ethers.Contract(d.address, artifact().abi, wallet);
const fmt = (x) => Number(ethers.formatEther(x)).toFixed(3);

const before = await perps.houseBalance();
console.log(`Depositing ${fmt(amount)} MON into the house on ${d.address} (wallet has ${fmt(await wallet.provider.getBalance(wallet.address))})`);
await (await perps.depositHouse({ value: amount })).wait();
const [after, reserved] = await Promise.all([perps.houseBalance(), perps.reserved()]);
console.log(`house ${fmt(before)} → ${fmt(after)} MON; reserved ${fmt(reserved)}; free ${fmt(after - reserved)}`);
