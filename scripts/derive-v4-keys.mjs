// Recovers the Uniswap v4 PoolKey (tickSpacing, hooks) for each v4 pool in src/data/pools.json.
// A v4 pool id is keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks)), so for a hookless
// pool with a known fee the tick spacing can be found by trying every value. Pools that do not resolve
// (hooked pools, dynamic fees) are left without a key and stay watch only in the app.
import { readFileSync, writeFileSync } from "fs";
import { encodeAbiParameters, keccak256 } from "viem";

const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const ZERO = "0x0000000000000000000000000000000000000000";
const file = new URL("../src/data/pools.json", import.meta.url);
const pools = JSON.parse(readFileSync(file, "utf8"));
const types = [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }];

let found = 0, missing = 0;
for (const p of pools) {
  if (p.dex !== "uniswap-v4-robinhood") continue;
  if (p.quote !== "USDG") { missing++; continue; }
  const [c0, c1] = BigInt(p.stock) < BigInt(USDG) ? [p.stock, USDG] : [USDG, p.stock];
  const fees = p.fee != null ? [p.fee] : [100, 500, 3000, 10000, 0x800000];
  let hit = null;
  outer: for (const fee of fees) {
    for (let ts = 1; ts <= 32767; ts++) {
      if (keccak256(encodeAbiParameters(types, [c0, c1, fee, ts, ZERO])) === p.pool.toLowerCase()) { hit = { fee, tickSpacing: ts }; break outer; }
    }
  }
  if (hit) { p.v4 = { fee: hit.fee, tickSpacing: hit.tickSpacing, hooks: ZERO }; found++; }
  else { delete p.v4; missing++; console.log("unresolved", p.symbol, p.name, p.pool); }
}
writeFileSync(file, JSON.stringify(pools, null, 2) + "\n");
console.log({ found, missing });
