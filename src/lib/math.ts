const Q96 = 2 ** 96;

/** Human price of the stock quoted in the other pool token, from a Uniswap-style sqrtPriceX96. */
export function priceFromSqrt(sqrtPriceX96: bigint, stockIsToken0: boolean, stockDecimals: number, quoteDecimals: number): number {
  const s = Number(sqrtPriceX96) / Q96;
  const p = s * s; // token1 raw per token0 raw
  return stockIsToken0
    ? p * 10 ** (stockDecimals - quoteDecimals)
    : 10 ** (stockDecimals - quoteDecimals) / p;
}

export function tokenOrder(a: string, b: string): [string, string] {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

/** Continuous rate per second (1e18 scaled) to APY. */
export function ratePerSecondToApy(ratePerSec: bigint): number {
  const r = Number(ratePerSec) / 1e18;
  return Math.exp(r * 365 * 86400) - 1;
}

export interface LeveragePlan {
  deposit: number;
  leverage: number;
  exposure: number;
  flash: number;
  tokens: number;
  debt: number;
  ltv: number;
  lltv: number;
  health: number;
  liqPrice: number;
  entryPrice: number;
  maxLeverage: number;
}

export function planLeverage(deposit: number, leverage: number, lltv: number, execPrice: number, oraclePrice: number, flashFeeBps = 0): LeveragePlan {
  const exposure = deposit * leverage;
  const flash = Math.max(exposure - deposit, 0);
  const tokens = execPrice > 0 ? exposure / execPrice : 0;
  const debt = flash * (1 + flashFeeBps / 10_000);
  const collateralValue = tokens * oraclePrice;
  const ltv = collateralValue > 0 ? debt / collateralValue : 0;
  const health = debt > 0 ? (collateralValue * lltv) / debt : Infinity;
  const liqPrice = tokens > 0 && debt > 0 ? debt / (tokens * lltv) : 0;
  return { deposit, leverage, exposure, flash, tokens, debt, ltv, lltv, health, liqPrice, entryPrice: execPrice, maxLeverage: 1 / (1 - lltv) };
}

export const fmtUsd = (n: number, digits = 2) => {
  if (!isFinite(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return sign + "$" + (a / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return sign + "$" + (a / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return sign + "$" + (a / 1e3).toFixed(1) + "K";
  return sign + "$" + a.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: a < 100 ? digits : 0 });
};
export const fmtPct = (n: number, digits = 2) => (isFinite(n) ? (n * 100).toFixed(digits) + "%" : "-");
export const fmtNum = (n: number, digits = 4) => (isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: digits }) : "-");
export const shortAddr = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
