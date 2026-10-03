import type { Snapshot, VenuePrice } from "@/lib/types";

export const V3 = "uniswap-v3-robinhood";

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
  /** both sides on Uniswap v3, which is what the router can trade */
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
    const executable = multi && buy.dex === V3 && sell.dex === V3 && !!buy.fee && !!sell.fee;
    out.push({ symbol, feed, buy, sell, gross, fees, net: gross - fees, venues: sorted, executable });
  }
  return out.sort((a, b) => b.net - a.net);
}
