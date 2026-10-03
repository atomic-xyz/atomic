"use client";

import { Counter, Eyebrow, Reveal } from "@/components/ui/primitives";
import { useSnapshot } from "@/hooks/useSnapshot";
import { STOCKS } from "@/lib/data";
import { fmtUsd } from "@/lib/math";

export function Thesis() {
  const { data } = useSnapshot();
  const flash = data?.flashLiquidityUSDG ?? 0;
  const poolTvl = data ? data.venues.reduce((a, v) => a + v.tvl, 0) : 0;

  return (
    <section className="relative mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
      <div className="grid gap-14 md:grid-cols-[1fr_1fr]">
        <div>
          <Reveal>
            <Eyebrow>Thesis</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 text-4xl leading-[1.02] tracking-[-0.02em] md:text-6xl">
              Stocks are tokens now.
              <br />
              <span className="font-display italic text-muted">Use them like one</span>
            </h2>
          </Reveal>
        </div>
        <div className="flex flex-col justify-end gap-6 text-lg leading-relaxed text-muted">
          <Reveal delay={0.1}>
            <p>
              On Robinhood Chain, NVDA and AAPL are ERC-20s. Uniswap holds their liquidity, Morpho accepts them as collateral, Chainlink prices them 24/5. Every piece is on-chain and composable, and the only way anyone uses them is still the broker way: buy, hold, sell.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <p>
              A hedge fund rotates NVDA into AAPL without settlement lag or idle cash because it has a prime broker. Retail sells, waits, buys. ATOMIC collapses the whole sequence into one call: borrow, swap, repay. The capital efficiency that used to need a relationship now needs a signature.
            </p>
          </Reveal>
        </div>
      </div>

      <div className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-4">
        {[
          { label: "Stock tokens deployed", value: STOCKS.length, fmt: (n: number) => Math.round(n).toString(), sub: "from the StockFactory, live" },
          { label: "Flashable USDG in Morpho", value: flash, fmt: (n: number) => fmtUsd(n), sub: "idle liquidity, zero fee" },
          { label: "Stock pool liquidity", value: poolTvl, fmt: (n: number) => fmtUsd(n), sub: "Uniswap v3, v4 and forks" },
          { label: "Block time", value: 100, fmt: (n: number) => `${Math.round(n)}ms`, sub: "every step settles together" },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.06} className="bg-bg p-7">
            <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-2">{s.label}</div>
            <div className="mt-3 text-4xl tracking-tight text-text">
              {s.value ? <Counter value={s.value} format={s.fmt} /> : <span className="skeleton inline-block h-9 w-28 align-middle" />}
            </div>
            <div className="mt-2 text-sm text-muted">{s.sub}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
