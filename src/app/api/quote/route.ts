import { NextRequest, NextResponse } from "next/server";
import { encodePacked, isAddress, type Address } from "viem";
import { publicClient } from "@/lib/chain";
import { ADDR } from "@/lib/addresses";
import { quoterV2Abi } from "@/lib/abis";

export const dynamic = "force-dynamic";

const FEES = [100, 500, 3000, 10000] as const;

export interface QuoteRoute { kind: "single" | "viaWETH" | "viaUSDG"; fees: number[]; amountOut: string; gas: string }
export interface QuoteResponse { tokenIn: string; tokenOut: string; amountIn: string; best: QuoteRoute | null; routes: QuoteRoute[] }

/** Best Uniswap v3 route for an exact-input swap: every single-hop fee tier plus two-hop via WETH. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tokenIn = sp.get("tokenIn")?.toLowerCase() as Address | undefined;
  const tokenOut = sp.get("tokenOut")?.toLowerCase() as Address | undefined;
  const amountInStr = sp.get("amountIn");
  if (!tokenIn || !tokenOut || !amountInStr) return NextResponse.json({ error: "tokenIn, tokenOut, amountIn required" }, { status: 400 });
  if (!isAddress(tokenIn) || !isAddress(tokenOut) || !/^\d{1,40}$/.test(amountInStr)) return NextResponse.json({ error: "malformed token address or amount" }, { status: 400 });
  let amountIn: bigint;
  try {
    amountIn = BigInt(amountInStr);
  } catch {
    return NextResponse.json({ error: "amountIn must be an integer string" }, { status: 400 });
  }
  const empty: QuoteResponse = { tokenIn, tokenOut, amountIn: amountInStr, best: null, routes: [] };
  if (amountIn <= 0n || tokenIn === tokenOut) return NextResponse.json(empty);

  const client = publicClient();
  const quoter = ADDR.UNI_V3_QUOTER_V2 as Address;
  const weth = ADDR.WETH as Address;

  const single = FEES.map((fee) => ({
    address: quoter, abi: quoterV2Abi, functionName: "quoteExactInputSingle" as const,
    args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }] as const,
    meta: { kind: "single" as const, fees: [fee] as number[] },
  }));
  const viaWeth = tokenIn !== weth && tokenOut !== weth
    ? ([100, 500, 3000] as const).flatMap((f1) => ([500, 3000, 10000] as const).map((f2) => ({
        address: quoter, abi: quoterV2Abi, functionName: "quoteExactInput" as const,
        args: [encodePacked(["address", "uint24", "address", "uint24", "address"], [tokenIn, f1, weth, f2, tokenOut]), amountIn] as const,
        meta: { kind: "viaWETH" as const, fees: [f1, f2] as number[] },
      })))
    : [];
  const usdg = ADDR.USDG as Address;
  const viaUsdg = tokenIn !== usdg && tokenOut !== usdg
    ? ([100, 500, 3000] as const).flatMap((f1) => ([100, 500, 3000] as const).map((f2) => ({
        address: quoter, abi: quoterV2Abi, functionName: "quoteExactInput" as const,
        args: [encodePacked(["address", "uint24", "address", "uint24", "address"], [tokenIn, f1, usdg, f2, tokenOut]), amountIn] as const,
        meta: { kind: "viaUSDG" as const, fees: [f1, f2] as number[] },
      })))
    : [];
  const all = [...single, ...viaWeth, ...viaUsdg];
  const contracts = all.map((c) => ({ address: c.address, abi: c.abi, functionName: c.functionName, args: c.args }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await client.multicall({ contracts: contracts as any, allowFailure: true });

  const routes: QuoteRoute[] = [];
  res.forEach((r, i) => {
    if (r.status !== "success") return;
    const tuple = r.result as readonly unknown[];
    const out = tuple[0] as bigint;
    const gas = tuple[3] as bigint;
    if (out > 0n) routes.push({ ...all[i].meta, amountOut: out.toString(), gas: gas.toString() });
  });
  routes.sort((a, b) => (BigInt(b.amountOut) > BigInt(a.amountOut) ? 1 : BigInt(b.amountOut) < BigInt(a.amountOut) ? -1 : 0));
  const body: QuoteResponse = { tokenIn, tokenOut, amountIn: amountInStr, best: routes[0] ?? null, routes };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
