"use client";

import Link from "next/link";
import { Eyebrow, Pill, Reveal, Ticker } from "@/components/ui/primitives";
import { useSnapshot } from "@/hooks/useSnapshot";
import { dexLabel, stockBySymbol } from "@/lib/data";
import { EXPLORER } from "@/lib/addresses";
import { fmtPct, fmtUsd } from "@/lib/math";
import { SpreadBoard } from "./SpreadBoard";

export function Markets() {
  const { data, isLoading } = useSnapshot();
  const markets = data?.markets ?? [];
  const venuesBySymbol = (sym: string) => (data?.venues ?? []).filter((v) => v.symbol === sym);

  return (
    <section id="markets" className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal>
            <Eyebrow>Live markets</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 text-4xl leading-[1.02] tracking-[-0.02em] md:text-5xl">
              What the router can <span className="font-display italic text-muted">reach today</span>
            </h2>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted">
            <Link href="/markets" className="btn-ghost rounded-full px-4 py-2 font-sans text-sm">All markets, venues and tokens</Link>
            {data ? (
              <>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-up blink" /> block {data.block.toLocaleString("en-US")}</span>
                <span className="text-muted-2">ETH {fmtUsd(data.ethUsd)}</span>
              </>
            ) : (
              <span className="skeleton h-3 w-40" />
            )}
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-12 overflow-hidden rounded-3xl border border-line">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[840px] text-sm">
            <thead className="bg-bg-2/80 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-2">
              <tr>
                <th className="px-5 py-4 text-left font-normal">Collateral</th>
                <th className="px-5 py-4 text-right font-normal">Oracle price</th>
                <th className="px-5 py-4 text-right font-normal">Max LTV</th>
                <th className="px-5 py-4 text-right font-normal">Max leverage</th>
                <th className="px-5 py-4 text-right font-normal">USDG supplied</th>
                <th className="px-5 py-4 text-right font-normal">Borrow APY</th>
                <th className="px-5 py-4 text-left font-normal">Venues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading && !data
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-5 py-4"><span className="skeleton block h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : markets.map((m) => {
                    const stock = stockBySymbol(m.symbol);
                    const venues = venuesBySymbol(m.symbol);
                    return (
                      <tr key={m.id} className="transition-colors hover:bg-text/[0.02]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Ticker symbol={m.symbol} />
                            <div>
                              <div className="font-medium">{m.symbol}</div>
                              <div className="text-xs text-muted">{stock?.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-mono">{fmtUsd(m.oraclePrice)}</td>
                        <td className="px-5 py-4 text-right font-mono">{fmtPct(m.lltv, 1)}</td>
                        <td className="px-5 py-4 text-right font-mono text-flash">{(1 / (1 - m.lltv)).toFixed(2)}x</td>
                        <td className="px-5 py-4 text-right font-mono">{fmtUsd(m.supplyUSDG)}<div className="text-[11px] text-muted-2">{fmtPct(m.utilization, 0)} used</div></td>
                        <td className="px-5 py-4 text-right font-mono">{fmtPct(m.borrowApy)}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {venues.length ? venues.slice(0, 3).map((v) => (
                              <Pill key={v.pool} tone="neutral">{dexLabel(v.dex)}{v.fee ? ` ${(v.fee / 10000).toFixed(2)}%` : ""} / {v.quote}</Pill>
                            )) : <span className="text-xs text-muted-2">quoter only</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg-2/60 px-5 py-3 font-mono text-[11px] text-muted">
          <span>Morpho markets with live USDG supply and a stock token as collateral. Rates read from the AdaptiveCurve IRM every 10 seconds.</span>
          <a href={`${EXPLORER}/address/0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010`} target="_blank" rel="noreferrer" className="hover:text-text">Morpho on Blockscout</a>
        </div>
      </Reveal>

      <Reveal delay={0.15} className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Spread board</Eyebrow>
            <h3 className="mt-4 text-2xl tracking-tight md:text-3xl">
              Every venue against its Chainlink feed, <span className="font-display italic text-muted">right now</span>
            </h3>
          </div>
          <Link href="/app?tab=arb" className="btn-ghost rounded-full px-5 py-2.5 text-sm">Open the scanner</Link>
        </div>
        <div className="mt-6">
          <SpreadBoard />
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted-2">Green trades above the feed, red below. Cells pulse when a venue sits more than 0.35% away, which is where two pool fees start to clear.</p>
      </Reveal>
    </section>
  );
}
