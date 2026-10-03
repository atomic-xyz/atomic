"use client";

import { useQuery } from "@tanstack/react-query";
import type { Snapshot } from "@/lib/types";
import type { QuoteResponse } from "@/app/api/quote/route";

export function useSnapshot() {
  return useQuery<Snapshot>({
    queryKey: ["snapshot"],
    queryFn: async () => {
      const r = await fetch("/api/snapshot", { cache: "no-store" });
      if (!r.ok) throw new Error("snapshot failed");
      return r.json();
    },
    refetchInterval: 10_000,
    staleTime: 8_000,
  });
}

export function useQuote(tokenIn?: string, tokenOut?: string, amountIn?: bigint) {
  const enabled = !!tokenIn && !!tokenOut && !!amountIn && amountIn > 0n && tokenIn !== tokenOut;
  return useQuery<QuoteResponse>({
    queryKey: ["quote", tokenIn, tokenOut, amountIn?.toString()],
    queryFn: async () => {
      const r = await fetch(`/api/quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn!.toString()}`, { cache: "no-store" });
      if (!r.ok) throw new Error("quote failed");
      return r.json();
    },
    enabled,
    refetchInterval: 12_000,
    staleTime: 8_000,
    placeholderData: (prev) => prev,
  });
}
