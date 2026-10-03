"use client";

import { useSnapshot } from "@/hooks/useSnapshot";
import { fmtPct, fmtUsd } from "@/lib/math";
import { dexLabel } from "@/lib/data";

export function TickerStrip() {
  const { data } = useSnapshot();
  const feeds = data
    ? Object.values(data.feeds)
        .map((f) => {
          const venues = data.venues.filter((v) => v.symbol === f.symbol);
          const best = venues.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))[0];
          return { symbol: f.symbol, price: f.price, dev: best?.deviation ?? 0, venue: best ? dexLabel(best.dex) : null };
        })
        .sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))
    : [];
  const venues = data ? data.venues.slice().sort((a, b) => b.vol24 - a.vol24).slice(0, 30) : [];

  const row1 = feeds.length ? feeds.slice(0, 28) : Array.from({ length: 12 }, (_, i) => ({ symbol: `----${i}`, price: 0, dev: 0, venue: null }));
  const row2 = venues.length ? venues : [];

  return (
    <div className="relative border-y border-line bg-bg-2/60">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bg to-transparent" />

      <div className="marquee">
        {/* about 6s per item keeps the strip near 45px/s whatever the item count */}
        <div className="marquee-track py-3" style={{ animationDuration: `${row1.length * 6}s` }}>
          {[...row1, ...row1].map((it, i) => (
            <div key={it.symbol + i} className="flex items-center gap-3 border-r border-line px-6 font-mono text-xs">
              {it.price ? (
                <>
                  <span className="font-semibold text-text">{it.symbol}</span>
                  <span className="text-muted">{fmtUsd(it.price)}</span>
                  {it.venue && (
                    <span className={`${Math.abs(it.dev) > 0.003 ? (it.dev > 0 ? "text-up" : "text-down") : "text-muted-2"}`}>
                      {it.dev > 0 ? "+" : ""}{fmtPct(it.dev)} <span className="text-muted-2">{it.venue}</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="skeleton h-3 w-32" />
              )}
            </div>
          ))}
        </div>
      </div>

      {row2.length > 0 && (
        <div className="marquee border-t border-line">
          <div className="marquee-track py-2.5 [animation-direction:reverse]" style={{ animationDuration: `${row2.length * 7}s` }}>
            {[...row2, ...row2].map((v, i) => (
              <div key={v.pool + i} className="flex items-center gap-2 border-r border-line px-5 font-mono text-[11px] text-muted">
                <span className="text-text">{v.symbol}/{v.quote}</span>
                <span className="text-muted-2">{dexLabel(v.dex)}{v.fee ? ` ${(v.fee / 10000).toFixed(2)}%` : ""}</span>
                <span>tvl {fmtUsd(v.tvl)}</span>
                <span className="text-muted-2">vol {fmtUsd(v.vol24)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="absolute right-6 top-3 z-20 hidden items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted md:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-up blink" /> Chainlink vs pools, live
      </div>
    </div>
  );
}
