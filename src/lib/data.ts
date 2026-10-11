import stocksJson from "@/data/stocks.json";
import feedsJson from "@/data/feeds.json";
import poolsJson from "@/data/pools.json";
import marketsJson from "@/data/markets.json";
import metaJson from "@/data/meta.json";

export interface Stock { symbol: string; name: string; address: string; block: number }
export interface Feed { address: string; decimals: number; name: string }
export interface Pool { symbol: string; stock: string; quote: "USDG" | "WETH"; dex: string; pool: string; name: string; fee: number | null; tvl: number; vol24: number; v4?: { fee: number; tickSpacing: number; hooks: string } }
export interface Market { id: string; symbol: string; collateral: string; oracle: string; irm: string; lltv: number; supplyUSDG: number; borrowUSDG: number }

export const STOCKS = stocksJson as Stock[];
export const FEEDS = feedsJson as Record<string, Feed>;
/** Every discovered stock pool; the site only works with the ones that hold real liquidity. */
export const ALL_POOLS = poolsJson as Pool[];
export const MIN_POOL_TVL_USD = 5_000;
/** DEX families whose pools expose a Uniswap v3 style slot0 (or v4 StateView) that the snapshot can price. */
export const PRICEABLE_DEXES = new Set(["uniswap-v3-robinhood", "uniswap-v4-robinhood", "ramses-v3-robinhood", "sushiswap-v3-robinhood", "giga-v3", "up-v3", "alandale-cl"]);
export const POOLS: Pool[] = ALL_POOLS.filter((p) => p.tvl >= MIN_POOL_TVL_USD && PRICEABLE_DEXES.has(p.dex));
export const MARKETS = marketsJson as Market[];
export const DATA_META = metaJson as { generatedAt: string; block: number };

export const stockBySymbol = (sym: string) => STOCKS.find((s) => s.symbol === sym);
export const stockByAddress = (addr: string) => STOCKS.find((s) => s.address === addr.toLowerCase());

/** Deepest live Morpho market per stock symbol and LLTV tier (a 62.5% pool and a 77% pool for the same stock both stay). */
export const PRIMARY_MARKETS: Market[] = Object.values(
  MARKETS.reduce<Record<string, Market>>((acc, m) => {
    const key = `${m.symbol}:${m.lltv}`;
    if (!acc[key] || acc[key].supplyUSDG < m.supplyUSDG) acc[key] = m;
    return acc;
  }, {}),
).sort((a, b) => b.supplyUSDG - a.supplyUSDG);

/** One market per collateral token, for balance and allowance reads. */
export const COLLATERAL_MARKETS: Market[] = PRIMARY_MARKETS.filter((m, i, all) => all.findIndex((x) => x.collateral === m.collateral) === i);

/** Never open above 90% of the liquidation threshold. */
export const SAFETY = 0.9;
/** The highest leverage a market allows: 1 / (1 - lltv * SAFETY), floored to two decimals. 62.5% gives 2.28x, 77% gives 3.26x. */
export const maxLeverageFor = (lltv: number) => Math.floor((1 / (1 - lltv * SAFETY)) * 100) / 100;
/** USDG the market can still lend. */
export const idleOf = (m: { supplyUSDG: number; borrowUSDG: number }) => Math.max(0, m.supplyUSDG - m.borrowUSDG);

/**
 * The market to open a position in: the highest-LLTV pool that allows this leverage and can still
 * lend the debt, else one that allows it (so the capacity warning can say what is missing), else
 * the deepest pool. Higher LLTV means a lower liquidation price for the same leverage.
 */
export function pickMarket<M extends { lltv: number; supplyUSDG: number; borrowUSDG: number }>(candidates: M[], leverage: number, debt: number): M | undefined {
  const allowing = candidates.filter((m) => maxLeverageFor(m.lltv) >= leverage - 1e-9).sort((a, b) => b.lltv - a.lltv || idleOf(b) - idleOf(a));
  return allowing.find((m) => idleOf(m) >= debt) ?? allowing.find((m) => idleOf(m) > 0) ?? allowing[0] ?? [...candidates].sort((a, b) => idleOf(b) - idleOf(a))[0];
}

export const DEX_LABEL: Record<string, string> = {
  "uniswap-v3-robinhood": "Uniswap v3",
  "uniswap-v4-robinhood": "Uniswap v4",
  "uniswap-v2-robinhood": "Uniswap v2",
  "ramses-v3-robinhood": "Ramses CL",
  "up-v3": "Up",
  "giga-v3": "giga",
  "alandale-cl": "Alandale",
  "sushiswap-v3-robinhood": "Sushi v3",
};
export const dexLabel = (id: string) => DEX_LABEL[id] ?? id;

/** Symbols that have at least one pool or market, deduped. */
export const TRADABLE_SYMBOLS: string[] = Array.from(
  new Set([...POOLS.map((p) => p.symbol), ...MARKETS.map((m) => m.symbol)]),
);
