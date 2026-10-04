import type { Address } from "viem";
import { ADDR, WETH_USDG_POOL } from "@/lib/addresses";
import type { Snapshot, VenuePrice } from "@/lib/types";

export const V3 = "uniswap-v3-robinhood";

/** Pool families AtomicArb can swap against directly: Uniswap v3 and forks that keep its swap interface. */
export const ARB_DEXES = new Set(["uniswap-v3-robinhood", "ramses-v3-robinhood", "sushiswap-v3-robinhood", "giga-v3"]);

export const V4 = "uniswap-v4-robinhood";
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

/** A pool the arbitrage contract can swap against: a v3 style pool, or a Uniswap v4 pool whose key is known. */
export const tradable = (v: VenuePrice) => ARB_DEXES.has(v.dex) || (v.dex === V4 && !!v.v4);

/** Matches the contract's Hop struct. v3 style pools only read `pool` and `tokenIn`. */
export interface ArbHop {
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

const v3Hop = (pool: Address, tokenIn: Address): ArbHop => ({ pool, tokenIn, tokenOut: ZERO, fee: 0, tickSpacing: 0, hooks: ZERO });

/** Hops for one side of the trade. WETH-quoted pools get the WETH/USDG pool as a bridge. */
export function arbHops(v: VenuePrice, stock: Address, side: "buy" | "sell"): ArbHop[] {
  const usdg = ADDR.USDG as Address;
  const weth = ADDR.WETH as Address;
  const pool = v.pool as Address;
  if (v.dex === V4) {
    // every v4 pool lives inside the PoolManager; the key picks the pool
    if (!v.v4 || v.quote !== "USDG") return [];
    const [tokenIn, tokenOut] = side === "buy" ? [usdg, stock] : [stock, usdg];
    return [{ pool: ADDR.UNI_V4_POOL_MANAGER as Address, tokenIn, tokenOut, fee: v.v4.fee, tickSpacing: v.v4.tickSpacing, hooks: v.v4.hooks as Address }];
  }
  if (v.quote === "USDG") return [v3Hop(pool, side === "buy" ? usdg : stock)];
  return side === "buy"
    ? [v3Hop(WETH_USDG_POOL, usdg), v3Hop(pool, weth)]
    : [v3Hop(pool, stock), v3Hop(WETH_USDG_POOL, weth)];
}

export interface Opp {
  symbol: string;
  feed: number;
  buy: VenuePrice;
  sell: VenuePrice;
  /** raw price gap between the cheapest and dearest pool, as a fraction */
  gross: number;
  /** both pool fees, as a fraction */
  fees: number;
  /** gross minus fees */
  net: number;
  venues: VenuePrice[];
  /** both sides on a pool family the arbitrage contract can trade */
  executable: boolean;
}

export const feeOf = (v: VenuePrice) => (v.fee ?? 3000) / 1_000_000;

/** One row per stock: the cheapest and dearest pool it trades in right now, and whether the gap pays for itself. */
export function buildOpps(data: Snapshot | undefined): Opp[] {
  if (!data) return [];
  const bySym = new Map<string, VenuePrice[]>();
  for (const v of data.venues) bySym.set(v.symbol, [...(bySym.get(v.symbol) ?? []), v]);
  const out: Opp[] = [];
  for (const [symbol, venues] of bySym) {
    const feed = data.feeds[symbol]?.price ?? 0;
    const sorted = [...venues].sort((a, b) => a.price - b.price);
    const buy = sorted[0];
    const sell = sorted[sorted.length - 1];
    const multi = venues.length > 1;
    const gross = multi ? sell.price / buy.price - 1 : 0;
    const fees = multi ? feeOf(buy) + feeOf(sell) : 0;
    const executable = multi && tradable(buy) && tradable(sell);
    out.push({ symbol, feed, buy, sell, gross, fees, net: gross - fees, venues: sorted, executable });
  }
  return out.sort((a, b) => b.net - a.net);
}
