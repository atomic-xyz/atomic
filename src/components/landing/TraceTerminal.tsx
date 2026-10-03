"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSnapshot } from "@/hooks/useSnapshot";

interface Line { text: string; tone: "muted" | "text" | "flash" | "up" | "volt"; step: number; indent?: number }

function buildLines(price: number, block: number): Line[] {
  const nvda = (2500 / price).toFixed(4);
  return [
    { text: `> atomic.execute(Leverage NVDA 2.5x, deposit 1,000 USDG)`, tone: "text", step: 0 },
    { text: `CALL Morpho.flashLoan(USDG, 1,500.00, data)`, tone: "flash", step: 0, indent: 1 },
    { text: `CALL onMorphoFlashLoan(1,500.00)`, tone: "volt", step: 0, indent: 2 },
    { text: `CALL SwapRouter02.exactInputSingle(USDG -> NVDA, 2,500.00, fee 500)`, tone: "text", step: 1, indent: 3 },
    { text: `<- ${nvda} NVDA at $${price.toFixed(2)}, 0.05% pool, 109k gas`, tone: "muted", step: 1, indent: 4 },
    { text: `CALL Morpho.supplyCollateral(NVDA/USDG 62.5%, ${nvda} NVDA)`, tone: "text", step: 2, indent: 3 },
    { text: `CALL Morpho.borrow(1,500.00 USDG, onBehalf user)`, tone: "text", step: 2, indent: 3 },
    { text: `<- LTV 60.0%, health 1.04, liq at -4.0%  (capped by max leverage in app)`, tone: "muted", step: 2, indent: 4 },
    { text: `USDG.transfer(Morpho, 1,500.00)  // repay inside callback, fee 0`, tone: "text", step: 3, indent: 3 },
    { text: `<- ok`, tone: "up", step: 3, indent: 2 },
    { text: `<- ok`, tone: "up", step: 3, indent: 1 },
    { text: `tx confirmed  block ${block.toLocaleString("en-US")}  1 block  ~0.1s  gas paid in ETH`, tone: "up", step: 3 },
  ];
}

export function TraceTerminal({ activeStep, onStep }: { activeStep: number; onStep: (s: number) => void }) {
  const { data } = useSnapshot();
  const price = data?.feeds.NVDA?.price ?? 223;
  const block = data?.block ?? 71_000_000;
  const [shown, setShown] = useState(0);
  const lines = buildLines(price, block);

  useEffect(() => {
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setShown(i);
      if (i <= lines.length) {
        onStep(lines[Math.min(i, lines.length) - 1]?.step ?? 0);
        setTimeout(tick, i === lines.length ? 3200 : 420 + Math.random() * 260);
      } else {
        i = 0;
        setShown(0);
        setTimeout(tick, 500);
      }
    };
    const t = setTimeout(tick, 400);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  const tones = { muted: "text-muted-2", text: "text-text", flash: "text-flash", up: "text-up", volt: "text-volt" };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-[var(--bg-2)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-[11px] text-muted">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-down/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-up/70" />
          <span className="ml-3 text-muted-2">trace</span>
        </div>
        <span className="text-muted-2">step {String(Math.min(activeStep + 1, 4)).padStart(2, "0")} / 04</span>
      </div>
      <div className="min-h-[360px] p-4 font-mono text-[12px] leading-[1.75]">
        {lines.slice(0, shown).map((l, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className={`${tones[l.tone]} whitespace-pre-wrap break-all ${l.step === activeStep && i > 0 ? "" : ""}`} style={{ paddingLeft: `${(l.indent ?? 0) * 14}px` }}>
            {l.indent ? <span className="text-muted-2">{"│ "}</span> : null}
            {l.text}
          </motion.div>
        ))}
        {shown < lines.length && <span className="inline-block h-4 w-2 translate-y-0.5 bg-flash blink" />}
      </div>
    </div>
  );
}
