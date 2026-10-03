"use client";

import { erc20Abi, type Address, type Hex } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { ADDR } from "@/lib/addresses";
import { PRIMARY_MARKETS, type Market } from "@/lib/data";
import { morphoAbi, ROUTER_ABI, ROUTER_ADDRESS, sharesToAssetsUp } from "@/lib/router";

const MORPHO = ADDR.MORPHO as Address;
const USDG = ADDR.USDG as Address;

export function useUsdgBalance() {
  const { address } = useAccount();
  return useReadContract({
    address: USDG, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
}

export function useUsdgAllowance() {
  const { address } = useAccount();
  return useReadContract({
    address: USDG, abi: erc20Abi, functionName: "allowance", args: address && ROUTER_ADDRESS ? [address, ROUTER_ADDRESS] : undefined,
    query: { enabled: !!address && !!ROUTER_ADDRESS, refetchInterval: 8_000 },
  });
}

export function useRouterAuthorized() {
  const { address } = useAccount();
  return useReadContract({
    address: MORPHO, abi: morphoAbi, functionName: "isAuthorized", args: address && ROUTER_ADDRESS ? [address, ROUTER_ADDRESS] : undefined,
    query: { enabled: !!address && !!ROUTER_ADDRESS, refetchInterval: 8_000 },
  });
}

export interface OnchainPosition {
  market: Market;
  collateral: bigint; // 18 decimals
  borrowShares: bigint;
  debt: bigint; // USDG, 6 decimals, rounded up
}

/** The connected wallet's positions across every live stock market. */
export function usePositions() {
  const { address } = useAccount();
  const contracts = address
    ? PRIMARY_MARKETS.flatMap((m) => [
        { address: MORPHO, abi: morphoAbi, functionName: "position" as const, args: [m.id as Hex, address] as const },
        { address: MORPHO, abi: morphoAbi, functionName: "market" as const, args: [m.id as Hex] as const },
      ])
    : [];
  const q = useReadContracts({ contracts, query: { enabled: !!address, refetchInterval: 8_000 } });
  const positions: OnchainPosition[] = [];
  if (q.data) {
    PRIMARY_MARKETS.forEach((m, i) => {
      const p = q.data![i * 2];
      const mk = q.data![i * 2 + 1];
      if (p.status !== "success" || mk.status !== "success") return;
      const [, borrowShares, collateral] = p.result as readonly [bigint, bigint, bigint];
      const [, , totalBorrowAssets, totalBorrowShares] = mk.result as readonly bigint[];
      if (collateral === 0n && borrowShares === 0n) return;
      positions.push({ market: m, collateral, borrowShares, debt: sharesToAssetsUp(borrowShares, totalBorrowAssets, totalBorrowShares) });
    });
  }
  return { ...q, positions };
}

export interface HolderStatus {
  /** the token that waives the router fee, zero address when the perk is not switched on yet */
  token: Address | null;
  /** minimum balance, raw units */
  min: bigint;
  /** connected wallet's balance, raw units */
  balance: bigint;
  /** true when the perk is on and the wallet qualifies */
  isHolder: boolean;
  /** true when the router has a holder token configured */
  enabled: boolean;
  /** router fee in basis points */
  feeBps: number;
}

const ZERO = "0x0000000000000000000000000000000000000000";

/** Whether the connected wallet holds enough ATOMIC to skip the router fee, read from the router itself. */
export function useHolderStatus(): HolderStatus & { isLoading: boolean } {
  const { address } = useAccount();
  const cfg = useReadContracts({
    contracts: ROUTER_ADDRESS
      ? [
          { address: ROUTER_ADDRESS, abi: ROUTER_ABI, functionName: "holderToken" },
          { address: ROUTER_ADDRESS, abi: ROUTER_ABI, functionName: "holderMin" },
          { address: ROUTER_ADDRESS, abi: ROUTER_ABI, functionName: "feeBps" },
        ]
      : [],
    query: { enabled: !!ROUTER_ADDRESS, refetchInterval: 30_000 },
  });
  const token = (cfg.data?.[0]?.result as Address | undefined) ?? null;
  const min = (cfg.data?.[1]?.result as bigint | undefined) ?? 0n;
  const feeBps = Number((cfg.data?.[2]?.result as number | undefined) ?? 5);
  const enabled = !!token && token.toLowerCase() !== ZERO;
  const bal = useReadContract({
    address: enabled ? (token as Address) : undefined, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined,
    query: { enabled: enabled && !!address, refetchInterval: 15_000 },
  });
  const balance = (bal.data as bigint | undefined) ?? 0n;
  return { token: enabled ? token : null, min, balance, enabled, isHolder: enabled && !!address && balance >= min, feeBps, isLoading: cfg.isLoading };
}

export interface StockHolding {
  market: Market;
  /** wallet balance of the collateral token, 18 decimals */
  balance: bigint;
  /** how much of it Morpho may already pull */
  allowance: bigint;
}

/** What the connected wallet holds of each stock that has a lending market, and its Morpho allowance. */
export function useStockHoldings() {
  const { address } = useAccount();
  const contracts = address
    ? PRIMARY_MARKETS.flatMap((m) => [
        { address: m.collateral as Address, abi: erc20Abi, functionName: "balanceOf" as const, args: [address] as const },
        { address: m.collateral as Address, abi: erc20Abi, functionName: "allowance" as const, args: [address, MORPHO] as const },
      ])
    : [];
  const q = useReadContracts({ contracts, query: { enabled: !!address, refetchInterval: 8_000 } });
  const holdings: StockHolding[] = PRIMARY_MARKETS.map((m, i) => ({
    market: m,
    balance: (q.data?.[i * 2]?.result as bigint | undefined) ?? 0n,
    allowance: (q.data?.[i * 2 + 1]?.result as bigint | undefined) ?? 0n,
  }));
  return { ...q, holdings };
}

/** USDG the connected wallet has approved for Morpho itself (repaying a loan directly). */
export function useUsdgAllowanceForMorpho() {
  const { address } = useAccount();
  return useReadContract({
    address: USDG, abi: erc20Abi, functionName: "allowance", args: address ? [address, MORPHO] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
}
