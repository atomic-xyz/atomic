"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pill, Reveal, Ticker } from "@/components/ui/primitives";
import { SectionHead } from "@/components/site/PageShell";
import { SpreadBoard } from "@/components/landing/SpreadBoard";
import { useSnapshot } from "@/hooks/useSnapshot";
import { FEEDS, POOLS, STOCKS, dexLabel } from "@/lib/data";
import { EXPLORER } from "@/lib/addresses";
import { fmtPct, fmtUsd, shortAddr } from "@/lib/math";

export function MarketsFull() {
  const { data } = useSnapshot();
  const [q, setQ] = useState("");
  const [onlyLive, setOnlyLive] = useState(false);

  const poolBySymbol = useMemo(() => POOLS.reduce<Record<string, number>>((a, p) => ({ ...a, [p.symbol]: (a[p.symbol] ?? 0) + 1 }), {}), []);
  const marketBySymbol = useMemo(() => new Set((data?.markets ?? []).map((m) => m.symbol)), [data]);
  const stocks = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return STOCKS.filter((s) => {
      if (onlyLive && !poolBySymbol[s.symbol] && !marketBySymbol.has(s.symbol) && !FEEDS[s.symbol]) return false;
      return !needle || s.symbol.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle);
    }).sort((a, b) => {
      const score = (s: typeof a) => (marketBySymbol.has(s.symbol) ? 4 : 0) + (poolBySymbol[s.symbol] ? 2 : 0) + (FEEDS[s.symbol] ? 1 : 0);
      return score(b) - score(a) || a.symbol.localeCompare(b.symbol);
    });
  }, [q, onlyLive, poolBySymbol, marketBySymbol]);

  const allVenues = (data?.venues ?? []).slice().sort((a, b) => b.vol24 - a.vol24);
  const venues = allVenues.slice(0, 40);
  const totalTvl = allVenues.reduce((a, v) => a + v.tvl, 0);
  const totalVol = allVenues.reduce((a, v) => a + v.vol24, 0);

  return (
    <>
      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { l: "Stock tokens deployed", v: String(STOCKS.length), s: "from the factory" },
            { l: "Live Morpho markets", v: data ? String(data.markets.length) : "-", s: "USDG loan, stock collateral" },
            { l: "Stock pool liquidity", v: data ? fmtUsd(totalTvl) : "-", s: `${allVenues.length} pools with $5k or more` },
            { l: "24h stock pool volume", v: data ? fmtUsd(totalVol) : "-", s: "GeckoTerminal, refreshed with the data pull" },
          ].map((c) => (
            <div key={c.l} className="card p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">{c.l}</div>
              <div className="mt-2 font-mono text-3xl tabular">{c.v}</div>
              <div className="mt-1 font-mono text-[11px] text-muted">{c.s}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-bg-2/40">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
          <SectionHead eyebrow="Lending" title="Morpho markets the router can" accent="borrow against">
            <a href={`${EXPLORER}/address/0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010`} target="_blank" rel="noreferrer" className="btn-ghost rounded-full px-4 py-2 font-mono text-xs">Morpho on Blockscout</a>
          </SectionHead>
          <Reveal className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(data?.markets ?? []).map((m) => (
              <div key={m.id} className="card p-5">
                <div className="flex items-center gap-3">
                  <Ticker symbol={m.symbol} size="lg" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium">{m.symbol}</span>
                      <Pill tone="flash">{(1 / (1 - m.lltv)).toFixed(2)}x max</Pill>
                    </div>
                    <div className="font-mono text-[11px] text-muted">{STOCKS.find((s) => s.symbol === m.symbol)?.name}</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-xs">
                  <div><div className="text-muted-2">oracle</div><div className="text-text">{fmtUsd(m.oraclePrice)}</div></div>
                  <div><div className="text-muted-2">LLTV</div><div className="text-text">{fmtPct(m.lltv, 1)}</div></div>
                  <div><div className="text-muted-2">supplied</div><div className="text-text">{fmtUsd(m.supplyUSDG)}</div></div>
                  <div><div className="text-muted-2">borrowed</div><div className="text-text">{fmtUsd(m.borrowUSDG)} <span className="text-muted-2">({fmtPct(m.utilization, 0)})</span></div></div>
                  <div><div className="text-muted-2">borrow APY</div><div className="text-text">{fmtPct(m.borrowApy)}</div></div>
                  <div><div className="text-muted-2">idle to borrow</div><div className="text-flash">{fmtUsd(Math.max(0, m.supplyUSDG - m.borrowUSDG))}</div></div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-text/8">
                  <div className="h-full rounded-full bg-flash" style={{ width: `${Math.min(m.utilization * 100, 100)}%` }} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <a href={`${EXPLORER}/address/${m.collateral}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-muted hover:text-text">{shortAddr(m.collateral)}</a>
                  <Link href={`/app?tab=leverage`} className="font-mono text-[11px] text-flash hover:underline">leverage {m.symbol}</Link>
                </div>
              </div>
            ))}
            {!data && Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <SectionHead eyebrow="Spread board" title="Every venue against its Chainlink feed," accent="right now">
          <Link href="/app?tab=arb" className="btn-ghost rounded-full px-4 py-2 text-sm">Open the scanner</Link>
        </SectionHead>
        <div className="mt-10"><SpreadBoard /></div>
      </section>

      <section className="border-y border-line bg-bg-2/40">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
          <SectionHead eyebrow="Venues" title="Where stock tokens trade" accent="on-chain"><span className="font-mono text-[11px] text-muted">top 40 pools by 24h volume</span></SectionHead>
          <Reveal className="mt-10 overflow-hidden rounded-3xl border border-line">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-bg-2/80 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-2">
                  <tr>
                    <th className="px-5 py-3 text-left font-normal">Pair</th>
                    <th className="px-5 py-3 text-left font-normal">Venue</th>
                    <th className="px-5 py-3 text-right font-normal">Price</th>
                    <th className="px-5 py-3 text-right font-normal">vs feed</th>
                    <th className="px-5 py-3 text-right font-normal">TVL</th>
                    <th className="px-5 py-3 text-right font-normal">24h volume</th>
                    <th className="px-5 py-3 text-right font-normal">Pool</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {venues.map((v) => (
                    <tr key={v.pool} className="transition-colors hover:bg-text/[0.02]">
                      <td className="px-5 py-3"><div className="flex items-center gap-3"><Ticker symbol={v.symbol} size="sm" /><span className="font-medium">{v.symbol}/{v.quote}</span></div></td>
                      <td className="px-5 py-3 text-muted">{dexLabel(v.dex)}{v.fee ? ` ${(v.fee / 10000).toFixed(2)}%` : ""}</td>
                      <td className="px-5 py-3 text-right font-mono">{fmtUsd(v.price)}</td>
                      <td className={`px-5 py-3 text-right font-mono ${!data?.feeds[v.symbol] ? "text-muted-2" : v.deviation > 0 ? "text-up" : v.deviation < 0 ? "text-down" : "text-muted"}`}>{data?.feeds[v.symbol] ? `${v.deviation >= 0 ? "+" : ""}${fmtPct(v.deviation)}` : "no feed"}</td>
                      <td className="px-5 py-3 text-right font-mono">{fmtUsd(v.tvl)}</td>
                      <td className="px-5 py-3 text-right font-mono">{fmtUsd(v.vol24)}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs"><a href={`${EXPLORER}/address/${v.dex === "uniswap-v4-robinhood" ? "0x8366a39cc670b4001a1121b8f6a443a643e40951" : v.pool}`} target="_blank" rel="noreferrer" className="text-muted hover:text-text">{shortAddr(v.pool)}</a></td>
                    </tr>
                  ))}
                  {!data && Array.from({ length: 8 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j} className="px-5 py-3"><span className="skeleton block h-4" /></td>)}</tr>)}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <SectionHead eyebrow="Directory" title={`All ${STOCKS.length} stock tokens`} accent="from the factory">
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticker or name" className="w-56 rounded-full border border-line bg-bg/60 px-4 py-2 text-sm outline-none focus:border-flash/50" />
            <button onClick={() => setOnlyLive((v) => !v)} className={`rounded-full border px-4 py-2 font-mono text-xs transition-colors ${onlyLive ? "border-flash text-flash" : "border-line text-muted"}`}>live only</button>
          </div>
        </SectionHead>
        <div className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stocks.map((s) => {
            const feed = data?.feeds[s.symbol]?.price;
            const pools = poolBySymbol[s.symbol] ?? 0;
            const market = marketBySymbol.has(s.symbol);
            return (
              <a key={s.address} href={`${EXPLORER}/token/${s.address}`} target="_blank" rel="noreferrer" className="card card-hover flex items-center gap-3 p-3">
                <Ticker symbol={s.symbol} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.symbol}</span>
                    <span className="font-mono text-xs text-muted">{feed ? fmtUsd(feed) : FEEDS[s.symbol] ? "" : ""}</span>
                  </div>
                  <div className="truncate text-[11px] text-muted">{s.name || "Stock token"}</div>
                  <div className="mt-1 flex gap-1.5 font-mono text-[9px] uppercase tracking-wider">
                    {market && <span className="rounded border border-flash/40 px-1 text-flash">morpho</span>}
                    {pools > 0 && <span className="rounded border border-line px-1 text-muted">{pools} pool{pools > 1 ? "s" : ""}</span>}
                    {FEEDS[s.symbol] && <span className="rounded border border-line px-1 text-muted">feed</span>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
        {stocks.length === 0 && <p className="mt-6 text-sm text-muted">Nothing matches that search.</p>}
      </section>
    </>
  );
}
