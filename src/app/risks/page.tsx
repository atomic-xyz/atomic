import type { Metadata } from "next";
import { PageHero, PageShell } from "@/components/site/PageShell";
import { RisksFull } from "@/components/pages/RisksFull";

export const metadata: Metadata = { title: "ATOMIC / Risks", description: "What can go wrong with leveraged stock tokens on Robinhood Chain, from issuer risk to weekend drift and sequencer halts." };

export default function RisksPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Read before you sign"
        title="Atomic means it happens or it does not."
        accent="It does not mean safe"
        lede="The transaction is all or nothing. The position it opens is not. Here is everything that can go wrong after the block confirms, grouped by where the risk lives: the asset, the market and the stack."
        watermark="rsk"
      />
      <RisksFull />
    </PageShell>
  );
}
