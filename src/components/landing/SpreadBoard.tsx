"use client";

import { motion } from "framer-motion";
import { useSnapshot } from "@/hooks/useSnapshot";
import { dexLabel } from "@/lib/data";
import { fmtPct, fmtUsd } from "@/lib/math";

/** Every venue as a heat cell: green above Chainlink, red below, brighter the further away. */
export function SpreadBoard() {
  const { data } = useSnapshot();
  const venues = (data?.venues ?? []).slice().sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)).slice(0, 20);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {(venues.length ? venues : Array.from({ length: 20 }, () => null)).map((v, i) => {
        if (!v) return <div key={i} className="skeleton h-24 rounded-2xl" />;
        const feed = data?.feeds[v.symbol]?.price;
        const d = v.deviation;
        const mag = feed ? Math.min(Math.abs(d) / 0.006, 1) : 0;
        const rgb = !feed ? "var(--muted-rgb)" : d >= 0 ? "var(--up-rgb)" : "var(--down-rgb)";
        return (
          <motion.div
            key={v.pool}
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02 }}
            className={`relative overflow-hidden rounded-2xl border p-3 ${mag > 0.6 ? "heat-pulse" : ""}`}
            style={{ borderColor: `rgba(${rgb},${0.15 + mag * 0.5})`, background: `linear-gradient(180deg, rgba(${rgb},${0.05 + mag * 0.22}), rgba(${rgb},0.02))` }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold">{v.symbol}</span>
              <span className="font-mono text-[10px] text-muted">{dexLabel(v.dex)}</span>
            </div>
            <div className="mt-3 font-mono text-xl tabular" style={{ color: `rgba(${rgb},${0.6 + mag * 0.4})` }}>
              {feed ? `${d >= 0 ? "+" : ""}${fmtPct(d)}` : "no feed"}
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-2">
              <span>{fmtUsd(v.price)}</span>
              <span>{feed ? `feed ${fmtUsd(feed)}` : v.quote}</span>
            </div>
            <div className="absolute bottom-0 left-0 h-0.5" style={{ width: `${mag * 100}%`, background: `rgba(${rgb},0.9)` }} />
          </motion.div>
        );
      })}
    </div>
  );
}
