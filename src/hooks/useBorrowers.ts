"use client";

import { useQuery } from "@tanstack/react-query";
import type { BorrowersResponse } from "@/app/api/borrowers/route";

export type { Borrower, BorrowersResponse } from "@/app/api/borrowers/route";

export function useBorrowers() {
  return useQuery<BorrowersResponse>({
    queryKey: ["borrowers"],
    queryFn: async () => {
      const r = await fetch("/api/borrowers", { cache: "no-store" });
      if (!r.ok) throw new Error("borrowers failed");
      return r.json();
    },
    refetchInterval: 10_000,
    staleTime: 8_000,
  });
}
