export interface FeedPrice { symbol: string; price: number; updatedAt: number }
export interface VenuePrice {
  symbol: string; pool: string; dex: string; quote: "USDG" | "WETH"; fee: number | null;
  price: number;
  tvl: number; vol24: number; liquidity: string;
  deviation: number;
}
export interface MarketLive {
  id: string; symbol: string; collateral: string; lltv: number; oracle: string; irm: string;
  supplyUSDG: number; borrowUSDG: number; utilization: number; borrowApy: number; oraclePrice: number;
}
export interface Snapshot {
  at: number; block: number;
  ethUsd: number; usdgUsd: number;
  feeds: Record<string, FeedPrice>;
  venues: VenuePrice[];
  markets: MarketLive[];
  flashLiquidityUSDG: number;
  stockCount: number;
}
