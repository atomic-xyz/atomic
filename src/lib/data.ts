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
export const PRICEABLE_DEXES = new Set(["uniswap-v3-robinhood", "uniswap-v4-robinhood", "ramses-v3-robinhood", "sushiswap-v3-robinhood", "giga-v3"]);
export const POOLS: Pool[] = ALL_POOLS.filter((p) => p.tvl >= MIN_POOL_TVL_USD && PRICEABLE_DEXES.has(p.dex));
export const MARKETS = marketsJson as Market[];
export const DATA_META = metaJson as { generatedAt: string; block: number };

export const stockBySymbol = (sym: string) => STOCKS.find((s) => s.symbol === sym);
export const stockByAddress = (addr: string) => STOCKS.find((s) => s.address === addr.toLowerCase());

/** Deepest live Morpho market per stock symbol. */
export const PRIMARY_MARKETS: Market[] = Object.values(
  MARKETS.reduce<Record<string, Market>>((acc, m) => {
    if (!acc[m.symbol] || acc[m.symbol].supplyUSDG < m.supplyUSDG) acc[m.symbol] = m;
    return acc;
  }, {}),
).sort((a, b) => b.supplyUSDG - a.supplyUSDG);

export const DEX_LABEL: Record<string, string> = {
  "uniswap-v3-robinhood": "Uniswap v3",
  "uniswap-v4-robinhood": "Uniswap v4",
  "uniswap-v2-robinhood": "Uniswap v2",
  "ramses-v3-robinhood": "Ramses CL",
  "up-v3": "Up v3",
  "alandale-cl": "Alandale CL",
  "sushiswap-v3-robinhood": "Sushi v3",
};
export const dexLabel = (id: string) => DEX_LABEL[id] ?? id;

/** Symbols that have at least one pool or market, deduped. */
export const TRADABLE_SYMBOLS: string[] = Array.from(
  new Set([...POOLS.map((p) => p.symbol), ...MARKETS.map((m) => m.symbol)]),
);
