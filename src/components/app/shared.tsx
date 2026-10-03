"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ticker } from "@/components/ui/primitives";
import { stockBySymbol } from "@/lib/data";
import { ATOMIC_ROUTER } from "@/lib/addresses";

export function Panel({ title, children, className = "", right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`card p-5 md:p-6 ${className}`}>
      {(title || right) && (
        <div className="mb-5 flex items-center justify-between">
          {title && <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Row({ label, value, sub, tone = "text" }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "text" | "flash" | "up" | "down" | "warn" | "muted" }) {
  const tones = { text: "text-text", flash: "text-flash", up: "text-up", down: "text-down", warn: "text-warn", muted: "text-muted" };
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right">
        <span className={`font-mono text-sm ${tones[tone]}`}>{value}</span>
        {sub && <span className="block font-mono text-[11px] text-muted-2">{sub}</span>}
      </span>
    </div>
  );
}

export function StockSelect({ value, onChange, options, label }: { value: string; onChange: (s: string) => void; options: string[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const stock = stockBySymbol(value);
  return (
    <div ref={ref} className="relative">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">{label}</div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-bg/60 px-3 py-2.5 text-left transition-colors hover:border-line-2">
        <span className="flex items-center gap-3">
          <Ticker symbol={value} />
          <span>
            <span className="block text-sm font-medium">{value}</span>
            <span className="block text-xs text-muted">{stock?.name ?? "Stock token"}</span>
          </span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl scrollbar-thin">
            {options.map((s) => (
              <li key={s}>
                <button onClick={() => { onChange(s); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-text/5 ${s === value ? "bg-text/5" : ""}`}>
                  <Ticker symbol={s} size="sm" />
                  <span className="font-medium">{s}</span>
                  <span className="truncate text-xs text-muted">{stockBySymbol(s)?.name}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AmountInput({ value, onChange, label, unit, hint }: { value: string; onChange: (v: string) => void; label: string; unit: string; hint?: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">
        <span className="shrink-0">{label}</span>
        <span className="truncate text-right normal-case tracking-normal">{hint}</span>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg/60 px-4 py-3 focus-within:border-flash/50">
        <input type="number" inputMode="decimal" min={0} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" className="w-full bg-transparent font-mono text-2xl tabular text-text outline-none placeholder:text-muted-2" />
        <span className="font-mono text-sm text-muted">{unit}</span>
      </div>
    </div>
  );
}

export function LtvBar({ ltv, lltv }: { ltv: number; lltv: number }) {
  const pct = Math.min(ltv / lltv, 1.05);
  const tone = pct < 0.6 ? "bg-up" : pct < 0.85 ? "bg-warn" : "bg-down";
  return (
    <div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-text/8">
        <motion.div className={`absolute inset-y-0 left-0 rounded-full ${tone}`} animate={{ width: `${Math.min(ltv * 100, 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        <div className="absolute inset-y-0 w-px bg-down" style={{ left: `${lltv * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-2">
        <span>0%</span>
        <span className="text-down">liquidation at {(lltv * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function ExecuteButton({ ready, label, onClick }: { ready: boolean; label: string; onClick?: () => void }) {
  const deployed = !!ATOMIC_ROUTER;
  return (
    <div>
      <button disabled={!deployed || !ready} onClick={onClick} className="btn-flash w-full rounded-2xl px-5 py-3.5 text-sm">
        {deployed ? label : "Router not deployed yet"}
      </button>
      {!deployed && <p className="mt-2 text-center font-mono text-[11px] text-muted-2">Every number above is a live quote. Signing opens once the ATOMIC router is verified on Blockscout.</p>}
    </div>
  );
}

export function StepList({ steps, accent = true }: { steps: { label: string; detail: string; venue: string }[]; accent?: boolean }) {
  return (
    <ol className="relative grid gap-1.5">
      <div className="absolute left-[9px] top-3 bottom-3 w-px bg-line" />
      {steps.map((s, i) => (
        <motion.li key={s.label + i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex items-start gap-3 pl-7">
          <span className={`absolute left-[5px] top-2 h-2.5 w-2.5 rounded-full border ${accent ? "border-flash bg-flash/30" : "border-line-2 bg-bg"}`} />
          <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-line bg-bg/40 px-3 py-2">
            <div>
              <span className="mr-2 font-mono text-[10px] text-muted-2">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm">{s.label}</span>
              <span className="ml-2 font-mono text-xs text-muted">{s.detail}</span>
            </div>
            <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">{s.venue}</span>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
