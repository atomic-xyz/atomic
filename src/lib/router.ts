import { encodePacked, parseAbi, type Abi, type Address, type Hex } from "viem";
import routerAbiJson from "@/lib/abis/AtomicRouter.json";
import { ADDR, ATOMIC_ARB, ATOMIC_ROUTER } from "@/lib/addresses";
import arbAbiJson from "@/lib/abis/AtomicArb.json";
import type { Market } from "@/lib/data";
import type { QuoteRoute } from "@/app/api/quote/route";

export const ROUTER_ABI = routerAbiJson as Abi;
export const ROUTER_ADDRESS = (ATOMIC_ROUTER || undefined) as Address | undefined;
export const ARB_ABI = arbAbiJson as Abi;
export const ARB_ADDRESS = ATOMIC_ARB as Address;

export const morphoAbi = parseAbi([
  "function setAuthorization(address authorized, bool newIsAuthorized)",
  "function isAuthorized(address authorizer, address authorized) view returns (bool)",
  "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
  "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
  // direct position management, used by the Borrow tab and by repay-and-withdraw
  "function supplyCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data)",
  "function borrow((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256, uint256)",
  "function repay((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256, uint256)",
  "function withdrawCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, address receiver)",
]);

export interface MarketParamsStruct {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
}

/** Morpho MarketParams tuple for a market from the data snapshot. */
export function marketParams(m: Pick<Market, "collateral" | "oracle" | "irm" | "lltv">): MarketParamsStruct {
  return {
    loanToken: ADDR.USDG as Address,
    collateralToken: m.collateral as Address,
    oracle: m.oracle as Address,
    irm: m.irm as Address,
    lltv: BigInt(Math.round(m.lltv * 1e18)),
  };
}

/** Uniswap v3 packed path: token, fee, token, fee, token ... */
export function v3Path(tokens: Address[], fees: number[]): Hex {
  if (tokens.length !== fees.length + 1) throw new Error("path shape");
  const types: ("address" | "uint24")[] = [];
  const values: (Address | number)[] = [];
  tokens.forEach((t, i) => {
    types.push("address");
    values.push(t);
    if (i < fees.length) {
      types.push("uint24");
      values.push(fees[i]);
    }
  });
  return encodePacked(types, values);
}

/** Turn a quote route from /api/quote into the packed path the router swaps along. */
export function routeToPath(tokenIn: Address, tokenOut: Address, route: QuoteRoute): Hex {
  if (route.kind === "single") return v3Path([tokenIn, tokenOut], [route.fees[0]]);
  const mid = (route.kind === "viaWETH" ? ADDR.WETH : ADDR.USDG) as Address;
  return v3Path([tokenIn, mid, tokenOut], [route.fees[0], route.fees[1]]);
}

/** Apply a slippage tolerance (in basis points) to a quoted output. */
export function withSlippage(amountOut: bigint, bps: number): bigint {
  return (amountOut * BigInt(10_000 - bps)) / 10_000n;
}

/** Morpho's toAssetsUp with virtual shares and assets. */
export function sharesToAssetsUp(shares: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  if (shares === 0n) return 0n;
  const num = shares * (totalAssets + 1n);
  const den = totalShares + 1_000_000n;
  return (num + den - 1n) / den;
}
