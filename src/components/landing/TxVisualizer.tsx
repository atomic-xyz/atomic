"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export interface TxStep { label: string; venue: string; detail: string }

export const LEVERAGE_STEPS: TxStep[] = [
  { label: "Flash borrow", venue: "Morpho", detail: "USDG, zero fee" },
  { label: "Swap", venue: "Uniswap v3", detail: "USDG to NVDA" },
  { label: "Supply", venue: "Morpho", detail: "NVDA as collateral" },
  { label: "Borrow", venue: "Morpho", detail: "USDG against it" },
  { label: "Repay", venue: "Morpho", detail: "flash loan closed" },
];

export function TxVisualizer({ steps = LEVERAGE_STEPS, title = "Leverage NVDA 2.5x", loop = true, compact = false }: { steps?: TxStep[]; title?: string; loop?: boolean; compact?: boolean }) {
  const [active, setActive] = useState(-1);
  const [settled, setSettled] = useState(false);
  const period = 900;

  useEffect(() => {
    let i = -1;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      if (i < steps.length) {
        setActive(i);
        setSettled(false);
        setTimeout(tick, period);
      } else {
        setActive(steps.length);
        setSettled(true);
        if (loop) setTimeout(() => { i = -1; setActive(-1); setSettled(false); setTimeout(tick, 600); }, 2200);
      }
    };
    const t = setTimeout(tick, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [steps, loop]);

  const done = active >= steps.length;

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-line bg-surface/70 ${compact ? "p-5" : "p-6 md:p-8"}`}>
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="relative">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-2">tx</span>
            <span className="font-mono text-sm text-text">{title}</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <AnimatePresence mode="wait">
              {done ? (
                <motion.span key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5 rounded-full border border-up/40 bg-up/10 px-2.5 py-1 text-up">
                  <span className="h-1.5 w-1.5 rounded-full bg-up" /> confirmed in 1 block
                </motion.span>
              ) : (
                <motion.span key="pending" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5 rounded-full border border-flash/40 bg-flash/10 px-2.5 py-1 text-flash">
                  <span className="h-1.5 w-1.5 rounded-full bg-flash blink" /> executing
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* The block: one container, every call inside */}
        <div className={`relative rounded-2xl border ${done ? "border-up/40" : "border-flash/30"} bg-bg/60 p-4 transition-colors duration-500 md:p-5`}>
          <div className="absolute -top-2.5 left-4 rounded-full border border-line bg-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            one block
          </div>
          <div className="relative mt-1 grid gap-2">
            {/* rail */}
            <div className="absolute left-[13px] top-3 bottom-3 w-px bg-line" />
            <motion.div
              className="absolute left-[13px] top-3 w-px bg-flash"
              animate={{ height: `${Math.max(0, Math.min(active, steps.length - 1)) / (steps.length - 1) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              style={{ maxHeight: "calc(100% - 24px)" }}
            />
            {steps.map((s, i) => {
              const state = i < active ? "done" : i === active ? "active" : "idle";
              return (
                <div key={s.label + i} className="relative flex items-center gap-3 py-1.5 pl-9">
                  <span
                    className={`absolute left-[7px] grid h-3.5 w-3.5 place-items-center rounded-full border transition-all duration-300 ${
                      state === "done" ? "border-flash bg-flash" : state === "active" ? "border-flash bg-bg pulse-ring" : "border-line-2 bg-bg"
                    }`}
                  >
                    {state === "done" && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    )}
                  </span>
                  <div className={`flex flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-all duration-300 ${
                    state === "active" ? "border-flash/40 bg-flash/5" : state === "done" ? "border-line bg-surface/60" : "border-transparent"
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-muted-2">{String(i + 1).padStart(2, "0")}</span>
                      <span className={`text-sm font-medium ${state === "idle" ? "text-muted" : "text-text"}`}>{s.label}</span>
                      <span className="hidden text-xs text-muted sm:inline">{s.detail}</span>
                    </div>
                    <span className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">{s.venue}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 font-mono text-[11px] text-muted">
          <div className="rounded-xl border border-line bg-bg/40 px-3 py-2">
            <div className="text-muted-2">capital in</div>
            <div className="text-text">1,000 USDG</div>
          </div>
          <div className="rounded-xl border border-line bg-bg/40 px-3 py-2">
            <div className="text-muted-2">flash borrowed</div>
            <div className="text-text">1,500 USDG</div>
          </div>
          <div className="rounded-xl border border-line bg-bg/40 px-3 py-2">
            <div className="text-muted-2">if any step fails</div>
            <div className={settled ? "text-up" : "text-text"}>nothing happened</div>
          </div>
        </div>
      </div>
    </div>
  );
}
