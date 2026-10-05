import { NextResponse } from "next/server";
import type { Abi, Address, Hex } from "viem";
import { publicClient } from "@/lib/chain";
import { ADDR } from "@/lib/addresses";
import { aggregatorAbi, algebraPoolAbi, erc20Abi, irmAbi, morphoAbi, morphoOracleAbi, slipstreamPoolAbi, stateViewAbi, v3PoolAbi } from "@/lib/abis";
import { FEEDS, POOLS, PRIMARY_MARKETS, STOCKS, TRADABLE_SYMBOLS } from "@/lib/data";
import { priceFromSqrt, ratePerSecondToApy, tokenOrder } from "@/lib/math";
import type { Snapshot, VenuePrice, MarketLive, FeedPrice } from "@/lib/types";

export const dynamic = "force-dynamic";

const TTL_MS = 8_000;
let cache: { at: number; data: Snapshot } | null = null;
let inflight: Promise<Snapshot> | null = null;

const QUOTE_DECIMALS = { USDG: 6, WETH: 18 } as const;

interface Call { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }

async function build(): Promise<Snapshot> {
  const client = publicClient();
  const feedSymbols = TRADABLE_SYMBOLS.filter((s) => FEEDS[s]);

  const calls: Call[] = [];
  for (const s of feedSymbols) calls.push({ address: FEEDS[s].address as Address, abi: aggregatorAbi, functionName: "latestRoundData" });
  calls.push({ address: ADDR.FEED_ETH_USD as Address, abi: aggregatorAbi, functionName: "latestRoundData" });
  calls.push({ address: ADDR.FEED_USDG_USD as Address, abi: aggregatorAbi, functionName: "latestRoundData" });
  for (const p of POOLS) {
    if (p.dex === "uniswap-v4-robinhood") {
      calls.push({ address: ADDR.UNI_V4_STATE_VIEW as Address, abi: stateViewAbi, functionName: "getSlot0", args: [p.pool as Hex] });
      calls.push({ address: ADDR.UNI_V4_STATE_VIEW as Address, abi: stateViewAbi, functionName: "getLiquidity", args: [p.pool as Hex] });
    } else if (p.dex === "alandale-cl") {
      calls.push({ address: p.pool as Address, abi: algebraPoolAbi, functionName: "globalState" });
      calls.push({ address: p.pool as Address, abi: v3PoolAbi, functionName: "liquidity" });
    } else {
      calls.push({ address: p.pool as Address, abi: p.dex === "up-v3" ? slipstreamPoolAbi : v3PoolAbi, functionName: "slot0" });
      calls.push({ address: p.pool as Address, abi: v3PoolAbi, functionName: "liquidity" });
    }
    // The fee a pool charges right now. Listings can be stale and some pools change their fee.
    calls.push({ address: p.pool.length === 42 ? (p.pool as Address) : (ADDR.USDG as Address), abi: v3PoolAbi, functionName: "fee" });
  }
  for (const m of PRIMARY_MARKETS) {
    calls.push({ address: ADDR.MORPHO as Address, abi: morphoAbi, functionName: "market", args: [m.id as Hex] });
    calls.push({ address: m.oracle as Address, abi: morphoOracleAbi, functionName: "price" });
  }
  calls.push({ address: ADDR.USDG as Address, abi: erc20Abi, functionName: "balanceOf", args: [ADDR.MORPHO as Address] });

  const [blockNumber, res] = await Promise.all([
    client.getBlockNumber(),
    client.multicall({ contracts: calls, allowFailure: true, batchSize: 8_192 }),
  ]);

  let i = 0;
  const feeds: Record<string, FeedPrice> = {};
  for (const s of feedSymbols) {
    const r = res[i++];
    if (r.status === "success") {
      const [, answer, , updatedAt] = r.result as readonly [bigint, bigint, bigint, bigint, bigint];
      feeds[s] = { symbol: s, price: Number(answer) / 10 ** FEEDS[s].decimals, updatedAt: Number(updatedAt) };
    }
  }
  const ethR = res[i++];
  const usdgR = res[i++];
  const ethUsd = ethR.status === "success" ? Number((ethR.result as readonly bigint[])[1]) / 1e8 : 0;
  const usdgUsd = usdgR.status === "success" ? Number((usdgR.result as readonly bigint[])[1]) / 1e8 : 1;

  const venues: VenuePrice[] = [];
  for (const p of POOLS) {
    const slot = res[i++];
    const liq = res[i++];
    const feeR = res[i++];
    if (slot.status !== "success") continue;
    let fee = p.fee;
    if (p.dex === "alandale-cl") fee = Number((slot.result as readonly unknown[])[2]);
    else if (p.dex !== "uniswap-v4-robinhood" && feeR.status === "success") fee = Number(feeR.result);
    const sqrt = (slot.result as readonly bigint[])[0];
    const quoteAddr = p.quote === "USDG" ? ADDR.USDG : ADDR.WETH;
    const [t0] = tokenOrder(p.stock, quoteAddr);
    const inQuote = priceFromSqrt(sqrt, t0 === p.stock, 18, QUOTE_DECIMALS[p.quote]);
    const price = p.quote === "USDG" ? inQuote * usdgUsd : inQuote * ethUsd;
    const feed = feeds[p.symbol]?.price;
    if (!isFinite(price) || price <= 0) continue;
    // A pool with no in-range liquidity, or a price more than 50% away from Chainlink, is broken or
    // abandoned (wrong decimals, drained range): its "price" is noise and would show absurd spreads.
    const liquidity = liq.status === "success" ? (liq.result as bigint) : 0n;
    if (liquidity === 0n) continue;
    if (feed && Math.abs(price / feed - 1) > 0.5) continue;
    venues.push({
      symbol: p.symbol, pool: p.pool, dex: p.dex, quote: p.quote, fee, price, v4: p.v4,
      tvl: p.tvl, vol24: p.vol24, liquidity: String(liquidity),
      deviation: feed ? (price - feed) / feed : 0,
    });
  }

  const marketRaw: { m: (typeof PRIMARY_MARKETS)[number]; market: readonly bigint[]; oracle: bigint }[] = [];
  for (const m of PRIMARY_MARKETS) {
    const mk = res[i++];
    const or = res[i++];
    if (mk.status !== "success") continue;
    marketRaw.push({ m, market: mk.result as readonly bigint[], oracle: or.status === "success" ? (or.result as bigint) : 0n });
  }
  const balR = res[i++];
  const flashLiquidityUSDG = balR.status === "success" ? Number(balR.result as bigint) / 1e6 : 0;

  // Second round: borrow rates need the market state we just read.
  const rateRes = await client.multicall({
    allowFailure: true,
    contracts: marketRaw.map(({ m, market }) => ({
      address: m.irm as Address, abi: irmAbi, functionName: "borrowRateView" as const,
      args: [
        { loanToken: ADDR.USDG as Address, collateralToken: m.collateral as Address, oracle: m.oracle as Address, irm: m.irm as Address, lltv: BigInt(Math.round(m.lltv * 1e18)) },
        { totalSupplyAssets: market[0], totalSupplyShares: market[1], totalBorrowAssets: market[2], totalBorrowShares: market[3], lastUpdate: market[4], fee: market[5] },
      ],
    })),
  });

  const markets: MarketLive[] = marketRaw.map(({ m, market, oracle }, k) => {
    const supply = Number(market[0]) / 1e6;
    const borrow = Number(market[2]) / 1e6;
    const rate = rateRes[k].status === "success" ? (rateRes[k].result as bigint) : 0n;
    return {
      id: m.id, symbol: m.symbol, collateral: m.collateral, lltv: m.lltv, oracle: m.oracle, irm: m.irm,
      supplyUSDG: supply, borrowUSDG: borrow, utilization: supply > 0 ? borrow / supply : 0,
      borrowApy: ratePerSecondToApy(rate),
      // Morpho oracle price is scaled by 1e36 * 10^(loanDecimals - collateralDecimals) = 1e24 here.
      oraclePrice: Number(oracle) / 1e24,
    };
  });

  return {
    at: Date.now(), block: Number(blockNumber), ethUsd, usdgUsd, feeds, venues, markets, flashLiquidityUSDG,
    stockCount: STOCKS.length,
  };
}

const HEADERS = { "Cache-Control": "public, s-maxage=8, stale-while-revalidate=30" };
const MAX_STALE_MS = 120_000;

function refresh() {
  if (!inflight) {
    inflight = build()
      .then((data) => { cache = { at: Date.now(), data }; return data; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Stale-while-revalidate: a snapshot that exists is returned at once and refreshed in the background,
 *  so clients never wait on a multicall that can take several seconds on public RPCs. */
export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data, { headers: HEADERS });
  if (cache && now - cache.at < MAX_STALE_MS) {
    refresh().catch(() => {});
    return NextResponse.json(cache.data, { headers: { ...HEADERS, "X-Stale": "1" } });
  }
  try {
    const data = await refresh();
    return NextResponse.json(data, { headers: HEADERS });
  } catch (e) {
    if (cache) return NextResponse.json(cache.data, { headers: { "X-Stale": "1" } });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
