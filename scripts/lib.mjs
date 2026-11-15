import { readFileSync } from "node:fs";
import { ethers } from "ethers";

export const RPC = process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
export const artifact = () =>
  JSON.parse(readFileSync(new URL("../out/PredictionPerps.sol/PredictionPerps.json", import.meta.url), "utf8"));
export const deployment = () =>
  JSON.parse(readFileSync(new URL("./deployment.json", import.meta.url), "utf8"));
export const provider = () => new ethers.JsonRpcProvider(RPC);
export const need = (name) => {
  const v = process.env[name];
  if (!v) throw Error(`Set ${name}`);
  return v;
};
