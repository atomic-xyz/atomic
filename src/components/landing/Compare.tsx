"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eyebrow, Reveal } from "@/components/ui/primitives";

const BROKER = [
  { label: "Sell NVDA", wait: "fill", hours: 0.2 },
  { label: "Wait for settlement", wait: "T+1", hours: 24 },
  { label: "Cash lands", wait: "idle", hours: 6 },
  { label: "Buy AAPL", wait: "fill", hours: 0.2 },
  { label: "Re-post margin", wait: "manual", hours: 2 },
];
const ATOMIC = ["Flash borrow", "Withdraw NVDA", "Swap", "Supply AAPL", "Repay"];
const TOTAL_HOURS = BROKER.reduce((a, b) => a + b.hours, 0);
const STARTS = BROKER.map((_, i) => BROKER.slice(0, i).reduce((a, b) => a + b.hours, 0));

export function Compare() {
  const [t, setT] = useState(0); // 0..1 progress of the loop
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    let lastT = -1;
    const loop = (now: number) => {
      // ~12 updates per second is plenty for progress bars and keeps React out of the frame loop.
      const next = Math.floor((((now - start) / 9000) % 1) * 110) / 110;
      if (next !== lastT) { lastT = next; setT(next); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hours = t * TOTAL_HOURS;
  const brokerSteps = BROKER.map((s, i) => {
    const p = Math.max(0, Math.min(1, (hours - STARTS[i]) / s.hours));
    return { ...s, p };
  });
  const atomicDone = t > 0.02;

  return (
    <section className="relative mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
      <Reveal>
        <Eyebrow>Same trade, two clocks</Eyebrow>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="mt-6 max-w-3xl text-4xl leading-[1.02] tracking-[-0.02em] md:text-6xl">
          Rotate NVDA into AAPL.
          <span className="font-display italic text-muted"> The broker way, then ours</span>
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        <Reveal className="card relative overflow-hidden p-7">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-2">brokerage account</span>
            <span className="font-mono text-2xl tabular text-muted">{hours.toFixed(1)}<span className="text-sm text-muted-2"> h</span></span>
          </div>
          <div className="mt-8 grid gap-3">
            {brokerSteps.map((s, i) => (
              <div key={s.label} className="grid grid-cols-[24px_1fr_auto] items-center gap-3">
                <span className={`font-mono text-[10px] ${s.p > 0 ? "text-text" : "text-muted-2"}`}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={s.p > 0 ? "text-text" : "text-muted"}>{s.label}</span>
                    <span className="font-mono text-[10px] uppercase text-muted-2">{s.wait}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-text/6">
                    <div className="h-full rounded-full bg-muted transition-[width] duration-100" style={{ width: `${s.p * 100}%` }} />
                  </div>
                </div>
                <span className="font-mono text-[10px] text-muted-2">{s.hours >= 1 ? `${s.hours}h` : `${Math.round(s.hours * 60)}m`}</span>
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-2 font-mono text-[11px] text-muted">
            <span className="rounded-full border border-line px-2.5 py-1">cash idle for a day</span>
            <span className="rounded-full border border-line px-2.5 py-1">two fills, two spreads</span>
            <span className="rounded-full border border-line px-2.5 py-1">exposure gap overnight</span>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="relative overflow-hidden rounded-[20px] border border-flash/30 bg-flash/[0.04] p-7">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(var(--flash-rgb),0.25),transparent_70%)]" />
          <div className="relative flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-flash">atomic</span>
            <span className="font-mono text-2xl tabular text-flash">0.1<span className="text-sm text-flash/60"> s</span></span>
          </div>
          <div className="relative mt-8 rounded-2xl border border-flash/30 bg-bg/60 p-4">
            <div className="absolute -top-2.5 left-4 rounded-full border border-flash/40 bg-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-flash">block n</div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {ATOMIC.map((s, i) => (
                <div
                  key={s}
                  style={{ transitionDelay: `${i * 30}ms` }}
                  className={`flex h-20 flex-col items-center justify-center rounded-xl border border-flash/30 px-1 text-center transition-colors duration-200 ${atomicDone ? "bg-flash/90 text-[var(--on-flash)]" : "bg-flash/15 text-flash"}`}
                >
                  <span className="font-mono text-[9px] opacity-70">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-1 text-[11px] font-medium leading-tight">{s}</span>
                </div>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={atomicDone ? "done" : "wait"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative mt-6 flex items-center justify-between font-mono text-[11px]">
              <span className="text-muted">{atomicDone ? "settled, debt untouched, exposure never left" : "waiting for block"}</span>
              <span className={atomicDone ? "text-up" : "text-muted-2"}>{atomicDone ? "confirmed" : "pending"}</span>
            </motion.div>
          </AnimatePresence>
          <div className="relative mt-7 flex flex-wrap gap-2 font-mono text-[11px] text-flash/80">
            <span className="rounded-full border border-flash/30 px-2.5 py-1">zero idle cash</span>
            <span className="rounded-full border border-flash/30 px-2.5 py-1">one swap, one spread</span>
            <span className="rounded-full border border-flash/30 px-2.5 py-1">no gap in exposure</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
