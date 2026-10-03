import type { Metadata } from "next";
import { PageHero, PageShell } from "@/components/site/PageShell";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { HowDetail } from "@/components/pages/HowDetail";

export const metadata: Metadata = { title: "ATOMIC / How it works", description: "How ATOMIC composes Morpho flash loans and Uniswap swaps into one atomic transaction on Robinhood Chain." };

export default function HowPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="How it works"
        title="Borrow, swap, repay,"
        accent="inside one block"
        lede="ATOMIC holds no deposits and runs no pool. It borrows liquidity that already exists on Morpho and Uniswap, uses it for the length of one transaction and hands it back. This page walks the trace, the routing, the contracts and the questions people ask before signing."
        watermark="tx"
      />
      <HowItWorks />
      <HowDetail />
    </PageShell>
  );
}
