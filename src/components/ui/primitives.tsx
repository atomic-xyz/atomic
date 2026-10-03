"use client";

import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import logosJson from "@/data/logos.json";

const LOGOS = logosJson as Record<string, "light" | "dark">;

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-muted ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-flash blink" />
      {children}
    </div>
  );
}

export function Reveal({ children, delay = 0, className = "", y = 24 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Counter({ value, format, className = "" }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 20 });
  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);
  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = format(v);
    });
    return unsub;
  }, [spring, format]);
  return <span ref={ref} className={`tabular ${className}`}>{format(0)}</span>;
}

export function Pill({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "flash" | "up" | "down" | "warn" | "volt"; className?: string }) {
  const tones: Record<string, string> = {
    neutral: "border-line-2 text-muted",
    flash: "border-flash/40 text-flash bg-flash/10",
    up: "border-up/40 text-up bg-up/10",
    down: "border-down/40 text-down bg-down/10",
    warn: "border-warn/40 text-warn bg-warn/10",
    volt: "border-volt/40 text-volt bg-volt/10",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider ${tones[tone]} ${className}`}>{children}</span>;
}

export function Stat({ label, value, sub, className = "" }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-2">{label}</span>
      <span className="text-lg font-medium tabular text-text">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/atomic-sphere-nav.png" alt="" width={256} height={256} className="h-10 w-10 select-none" draggable={false} />
      <span className="text-[15px] font-bold tracking-[0.2em]" style={{ fontFamily: "var(--font-display)" }}>ATOMIC</span>
    </span>
  );
}

export function Ticker({ symbol, size = "md" }: { symbol: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: "h-6 w-6 rounded-[7px] text-[9px]", md: "h-8 w-8 rounded-[9px] text-[10px]", lg: "h-11 w-11 rounded-xl text-xs", xl: "h-16 w-16 rounded-2xl text-sm" };
  const [failed, setFailed] = useState(false);
  const tile = LOGOS[symbol];
  const hasLogo = !!tile && !failed;
  const hue = Array.from(symbol).reduce((a, c) => a + c.charCodeAt(0) * 17, 0) % 360;
  if (hasLogo) {
    return (
      <span
        className={`relative grid shrink-0 place-items-center overflow-hidden ${sizes[size]}`}
        style={{ background: tile === "dark" ? "linear-gradient(160deg, #1b1f27, #0d1015)" : "linear-gradient(160deg, #ffffff, #eef0f3)", boxShadow: "inset 0 0 0 1px rgba(var(--text-rgb),0.12), 0 1px 2px rgba(var(--shadow-rgb),0.3)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/logos/${symbol}.png`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-[84%] w-[84%] object-contain" draggable={false} />
      </span>
    );
  }
  return (
    <span
      className={`grid shrink-0 place-items-center font-mono font-semibold tracking-tight ${sizes[size]}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 22%), hsl(${(hue + 40) % 360} 60% 12%))`, color: `hsl(${hue} 90% 80%)`, boxShadow: "inset 0 0 0 1px rgba(var(--text-rgb),0.1)" }}
    >
      {symbol.slice(0, 4)}
    </span>
  );
}
