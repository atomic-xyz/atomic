"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Ticker } from "@/components/ui/primitives";
import { useBorrowers, type Borrower } from "@/hooks/useBorrowers";
import { ShareButton } from "./ShareCard";
import { useSnapshot } from "@/hooks/useSnapshot";
import { useNow } from "@/hooks/useNow";
import { fmtPct, fmtUsd } from "@/lib/math";
import { EXPLORER } from "@/lib/addresses";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function healthTone(drop: number | null): { label: string; cls: string } {
  if (drop === null) return { label: "no loan", cls: "border-line-2 text-muted" };
  if (drop < 0.08) return { label: "close to liquidation", cls: "border-down/40 bg-down/10 text-down" };
  if (drop < 0.2) return { label: "watch", cls: "border-warn/40 bg-warn/10 text-warn" };
  return { label: "safe", cls: "border-up/40 bg-up/10 text-up" };
}

export function BorrowersPanel() {
  const { data, isLoading, isError, dataUpdatedAt } = useBorrowers();
  const { data: snap } = useSnapshot();
  const now = useNow();
  const [filter, setFilter] = useState<string>("all");

  const symbols = useMemo(() => Object.entries(data?.bySymbol ?? {}).sort((a, b) => b[1].borrowUsd - a[1].borrowUsd), [data]);
  const rows = useMemo(() => (data?.borrowers ?? []).filter((b) => filter === "all" || b.symbol === filter), [data, filter]);
  const avgLeverage = useMemo(() => {
    const withLev = (data?.borrowers ?? []).filter((b) => Number.isFinite(b.leverage) && b.borrowUsd >= 1);
    if (!withLev.length) return 0;
    // weighted by loan size so dust positions do not dominate
    const w = withLev.reduce((s, b) => s + b.borrowUsd, 0);
    return withLev.reduce((s, b) => s + b.leverage * b.borrowUsd, 0) / w;
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
        Every wallet with a loan against a stock token on Morpho, refreshed every ten seconds. <b className="text-text">Profit</b> is live: what the position is worth now minus what the wallet put in.
        <b className="text-text"> Leverage</b> is how much bigger the position is than their own money. <b className="text-text">Closes if drop</b> is how far the stock can fall before it is liquidated.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Open loans", v: data ? String(data.count) : null, s: "wallets borrowing right now" },
          { l: "Borrowed in total", v: data ? fmtUsd(data.totalBorrowUsd) : null, s: "USDG owed against stock tokens" },
          { l: "Profit of all open loans", v: data ? `${data.totalPnlUsd >= 0 ? "+" : ""}${fmtUsd(data.totalPnlUsd)}` : null, s: "live, since each wallet entered", tone: data ? (data.totalPnlUsd >= 0 ? "text-up" : "text-down") : "" },
          { l: "Typical leverage", v: data ? `${avgLeverage.toFixed(2)}x` : null, s: "weighted by loan size" },
        ].map((k) => (
          <div key={k.l} className="card p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">{k.l}</div>
            <div className={`mt-1.5 font-mono text-xl tabular ${"tone" in k ? k.tone : ""}`}>{k.v ?? <span className="skeleton inline-block h-6 w-20" />}</div>
            <div className="mt-1 font-mono text-[11px] text-muted">{k.s}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter("all")} className={`rounded-full border px-3 py-1 font-mono text-[11px] ${filter === "all" ? "border-flash bg-flash text-[var(--on-flash)]" : "border-line text-muted hover:border-line-2"}`}>
            all {data ? `(${data.count})` : ""}
          </button>
          {symbols.map(([sym, agg]) => (
            <button key={sym} onClick={() => setFilter(sym)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] ${filter === sym ? "border-flash bg-flash text-[var(--on-flash)]" : "border-line text-muted hover:border-line-2"}`}>
              {sym} <span className="opacity-70">({agg.count})</span>
            </button>
          ))}
        </div>
        <div className="font-mono text-[11px] text-muted-2">
          {isError && !data ? "Morpho index unreachable, retrying" : data ? `refreshed ${Math.max(0, Math.round((now - dataUpdatedAt) / 1000))}s ago${snap ? `, block ${snap.block.toLocaleString("en-US")}` : ""}` : "loading"}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[40px_1.2fr_0.9fr_1fr_1fr_1fr_1.3fr_0.7fr_1fr_1.2fr] items-center gap-3 border-b border-line px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2 md:grid">
          <span>#</span><span>Who</span><span>Stock</span><span className="text-right">Holds</span><span className="text-right">Owes</span><span className="text-right">Their money</span><span className="text-right">Profit, live</span><span className="text-right">Leverage</span><span className="text-right">Closes if drop</span><span className="text-right">Status</span>
        </div>
        {isLoading && !data && Array.from({ length: 6 }, (_, i) => <div key={i} className="border-b border-line px-5 py-4"><div className="skeleton h-4 w-full" /></div>)}
        {rows.map((b, i) => <BorrowerRow key={`${b.address}-${b.marketId}`} b={b} rank={i + 1} price={snap?.feeds[b.symbol]?.price ?? null} />)}
        {data && rows.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted">No open loans on this stock right now.</div>}
      </div>

      <p className="font-mono text-[11px] text-muted-2">
        Source: Morpho Blue on Robinhood Chain via Morpho&apos;s indexer. Profit is before gas and any fees paid to other apps, and uses the hourly price at the time of each deposit, so it can be off by the move inside that hour.
      </p>
    </div>
  );
}

function Pnl({ b }: { b: Borrower }) {
  if (b.pnlUsd === null) return <span className="text-muted-2">-</span>;
  const up = b.pnlUsd >= 0;
  return (
    <span className={up ? "text-up" : "text-down"} title={b.entryPrice ? `entered at ${fmtUsd(b.entryPrice)}, put in ${fmtUsd(b.cashIn ?? 0)}` : undefined}>
      {up ? "+" : ""}{fmtUsd(b.pnlUsd)}
      {b.pnlPct !== null && <span className="ml-1 text-[11px] opacity-80">({b.pnlPct >= 0 ? "+" : ""}{fmtPct(b.pnlPct, 1)})</span>}
    </span>
  );
}

function BorrowerRow({ b, rank, price }: { b: Borrower; rank: number; price: number | null }) {
  const share = { symbol: b.symbol, leverage: Number.isFinite(b.leverage) ? b.leverage : 1, pnlPct: b.pnlPct, pnlUsd: b.pnlUsd, collateralUsd: b.collateralUsd, entryPrice: b.entryPrice, price, kind: "board" as const };
  const tone = healthTone(b.dropToLiquidation);
  const lev = Number.isFinite(b.leverage) ? `${b.leverage.toFixed(2)}x` : "max";
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(rank, 12) * 0.03 }} className="border-b border-line last:border-b-0">
      <div className="hidden grid-cols-[40px_1.2fr_0.9fr_1fr_1fr_1fr_1.3fr_0.7fr_1fr_1.2fr] items-center gap-3 px-5 py-3.5 text-sm md:grid">
        <span className="font-mono text-xs text-muted-2">{String(rank).padStart(2, "0")}</span>
        <span className="inline-flex items-center gap-2">
          <a href={`${EXPLORER}/address/${b.address}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-text hover:underline">{short(b.address)}</a>
          <ShareButton data={share} label="" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-line text-muted-2 transition-colors hover:border-line-2 hover:text-text" />
        </span>
        <span className="inline-flex items-center gap-2"><Ticker symbol={b.symbol} size="sm" /><span className="font-mono text-xs">{b.symbol}</span></span>
        <span className="text-right font-mono tabular">{fmtUsd(b.collateralUsd)}</span>
        <span className="text-right font-mono tabular">{fmtUsd(b.borrowUsd)}</span>
        <span className="text-right font-mono tabular">{fmtUsd(b.equityUsd)}</span>
        <span className="text-right font-mono tabular"><Pnl b={b} /></span>
        <span className="text-right font-mono tabular">{lev}</span>
        <span className="text-right font-mono tabular">{b.dropToLiquidation === null ? "-" : fmtPct(b.dropToLiquidation, 0)}</span>
        <span className="text-right"><span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] ${tone.cls}`}>{tone.label}</span></span>
      </div>
      <div className="flex flex-col gap-2 px-4 py-4 md:hidden">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2"><Ticker symbol={b.symbol} size="sm" /><a href={`${EXPLORER}/address/${b.address}`} target="_blank" rel="noreferrer" className="font-mono text-xs hover:underline">{short(b.address)}</a></span>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${tone.cls}`}>{tone.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
          <span>holds <b className="text-text">{fmtUsd(b.collateralUsd)}</b> {b.symbol}</span>
          <span>owes <b className="text-text">{fmtUsd(b.borrowUsd)}</b></span>
          <span>their money <b className="text-text">{fmtUsd(b.equityUsd)}</b></span>
          <span>profit <Pnl b={b} /></span>
          <span>leverage <b className="text-text">{lev}</b>, closes if drop <b className="text-text">{b.dropToLiquidation === null ? "-" : fmtPct(b.dropToLiquidation, 0)}</b></span>
        </div>
      </div>
    </motion.div>
  );
}
