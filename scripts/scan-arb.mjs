// Simulates every ordered pair of tradable pools for every stock, at several sizes, against the live
// AtomicArb contract, and prints what would actually make money right now. Read only: it sends nothing.
// Usage: node scripts/scan-arb.mjs [snapshot url]
import { readFileSync } from "fs";
import { createPublicClient, http } from "viem";

const SNAPSHOT = process.argv[2] ?? "https://useatomic.xyz/api/snapshot";
const ARB = process.env.ATOMIC_ARB ?? "0x65Db7Bf6Bc52C4725117f7490617b13d7a8e3fB9";
const RPC = process.env.RPC_URL ?? "https://robinhood.drpc.org";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const WETH_USDG_POOL = "0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca";
const POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
const ZERO = "0x0000000000000000000000000000000000000000";
const V3_STYLE = new Set(["uniswap-v3-robinhood", "ramses-v3-robinhood", "sushiswap-v3-robinhood", "giga-v3", "up-v3", "alandale-cl"]);
const SIZES = [10, 50, 250, 1000, 5000];
const MIN_EDGE = Number(process.env.MIN_EDGE ?? -0.002); // skip pairs whose quoted gap is further than this from paying

const abi = JSON.parse(readFileSync(new URL("../src/lib/abis/AtomicArb.json", import.meta.url), "utf8"));
const pools = JSON.parse(readFileSync(new URL("../src/data/pools.json", import.meta.url), "utf8"));
const stockOf = Object.fromEntries(pools.map((p) => [p.symbol, p.stock]));
const client = createPublicClient({ transport: http(RPC, { retryCount: 3, retryDelay: 400, timeout: 20_000 }) });

const v3 = (pool, tokenIn) => ({ pool, tokenIn, tokenOut: ZERO, fee: 0, tickSpacing: 0, hooks: ZERO });
const tradable = (v) => V3_STYLE.has(v.dex) || (v.dex === "uniswap-v4-robinhood" && v.v4 && v.quote === "USDG");
function hops(v, stock, side) {
  if (v.dex === "uniswap-v4-robinhood") {
    const [tokenIn, tokenOut] = side === "buy" ? [USDG, stock] : [stock, USDG];
    return [{ pool: POOL_MANAGER, tokenIn, tokenOut, fee: v.v4.fee, tickSpacing: v.v4.tickSpacing, hooks: v.v4.hooks }];
  }
  if (v.quote === "USDG") return [v3(v.pool, side === "buy" ? USDG : stock)];
  return side === "buy" ? [v3(WETH_USDG_POOL, USDG), v3(v.pool, WETH)] : [v3(v.pool, stock), v3(WETH_USDG_POOL, WETH)];
}

const snap = await (await fetch(SNAPSHOT)).json();
const bySym = new Map();
for (const v of snap.venues) if (tradable(v)) bySym.set(v.symbol, [...(bySym.get(v.symbol) ?? []), v]);

const jobs = [];
for (const [symbol, venues] of bySym) {
  for (const b of venues) for (const s of venues) {
    if (b === s) continue;
    const edge = s.price / b.price - 1 - ((b.fee ?? 3000) + (s.fee ?? 3000)) / 1e6;
    if (edge < MIN_EDGE) continue;
    for (const size of SIZES) jobs.push({ symbol, b, s, size, edge });
  }
}
console.log(`${snap.venues.length} pools priced, ${[...bySym.values()].flat().length} tradable, ${jobs.length} simulations`);

const wins = [];
const holderWins = [];
let nearest = null;
let done = 0, failed = 0;
const CHUNK = 6;
for (let i = 0; i < jobs.length; i += CHUNK) {
  await Promise.all(jobs.slice(i, i + CHUNK).map(async (j) => {
    const stock = stockOf[j.symbol];
    try {
      const r = await client.simulateContract({
        address: ARB, abi, functionName: "arb", account: "0x1111111111111111111111111111111111111111",
        args: [BigInt(j.size) * 1_000_000n, hops(j.b, stock, "buy"), hops(j.s, stock, "sell"), 0n],
      });
      const profit = Number(r.result) / 1e6;
      if (profit > 0) wins.push({ ...j, profit });
    } catch (e) {
      const m = JSON.stringify(e, (k, v) => (typeof v === "bigint" ? v.toString() : v)).match(/0x2c19b8b8([0-9a-f]{64})([0-9a-f]{64})/i);
      if (m) {
        const short = Number(BigInt("0x" + m[2]) - BigInt("0x" + m[1])) / 1e6;
        // what the round trip made before the ATOMIC fee: holders pay no fee, so this is their result
        const gross = Number(BigInt("0x" + m[1])) / 1e6 - j.size;
        if (gross > 0) holderWins.push({ ...j, profit: gross });
        const rel = short / j.size;
        if (!nearest || rel < nearest.rel) nearest = { ...j, short, rel };
      } else { failed++; if (failed === 1) console.log("first failure:", String(e.shortMessage ?? e.message).slice(0, 300), String(e.cause?.cause?.details ?? e.cause?.details ?? "").slice(0, 300)); }
    }
    done++;
  }));
}
const name = (v) => `${v.dex.replace("-robinhood", "")} ${((v.fee ?? 0) / 1e4).toFixed(2)}% ${v.quote}`;
wins.sort((x, y) => y.profit - x.profit);
console.log(`\n${wins.length} profitable simulations, ${failed} could not be simulated`);
for (const w of wins.slice(0, 25)) console.log(`  ${w.symbol.padEnd(5)} $${String(w.size).padEnd(5)} profit $${w.profit.toFixed(4)}  buy ${name(w.b)}  sell ${name(w.s)}`);
holderWins.sort((x, y) => y.profit - x.profit);
console.log(`
${holderWins.length} more would pay for a holder (no ATOMIC fee):`);
for (const w of holderWins.slice(0, 25)) console.log(`  ${w.symbol.padEnd(5)} $${String(w.size).padEnd(5)} profit $${w.profit.toFixed(4)}  buy ${name(w.b)}  sell ${name(w.s)}`);
if (nearest) console.log(`\nclosest miss: ${nearest.symbol} at $${nearest.size}, ${(nearest.rel * 100).toFixed(3)}% short ($${nearest.short.toFixed(4)})  buy ${name(nearest.b)}  sell ${name(nearest.s)}`);
