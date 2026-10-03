import type { Metadata } from "next";
import { PageHero, PageShell } from "@/components/site/PageShell";
import { MarketsFull } from "@/components/pages/MarketsFull";

export const metadata: Metadata = { title: "ATOMIC / Markets", description: "Live Morpho markets, Uniswap venues, spreads and the full stock token directory on Robinhood Chain." };

export default function MarketsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Markets"
        title="Everything the router"
        accent="can reach today"
        lede="Every number here is read from Robinhood Chain every ten seconds: Morpho market state and rates, pool prices on Uniswap v3, v4 and forks, Chainlink feeds and the full list of stock tokens the factory has deployed."
        cta={{ href: "/app?tab=arb", label: "Open the scanner" }}
        watermark="mkt"
      />
      <MarketsFull />
    </PageShell>
  );
}
