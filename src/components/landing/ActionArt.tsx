"use client";

import { motion } from "framer-motion";

/** Leverage: bars climb from 1x to 2.5x while a lime bar shows borrowed exposure. */
export function LeverageArt() {
  const bars = [1, 1.5, 2, 2.5];
  return (
    <svg viewBox="0 0 320 160" className="h-40 w-full" aria-hidden>
      <defs>
        <linearGradient id="lg-flash" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--flash)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--flash)" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <line x1="16" x2="304" y1="140" y2="140" stroke="rgba(var(--text-rgb),0.12)" />
      {bars.map((m, i) => {
        const x = 40 + i * 66;
        const base = 36;
        const total = base * m;
        return (
          <g key={m}>
            <motion.rect x={x} width="40" rx="4" fill="rgba(var(--text-rgb),0.14)" initial={{ y: 140, height: 0 }} animate={{ y: 140 - base, height: base }} transition={{ duration: 0.8, delay: i * 0.25, ease: "easeOut" }} />
            <motion.rect x={x} width="40" rx="4" fill="url(#lg-flash)" initial={{ y: 140 - base, height: 0 }} animate={{ y: [140 - base, 140 - total, 140 - total, 140 - base], height: [0, total - base, total - base, 0] }} transition={{ duration: 4, times: [0, 0.3, 0.8, 1], delay: i * 0.25, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }} />
            <motion.text x={x + 20} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fill="var(--flash)" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0], y: [140 - base - 8, 140 - total - 8, 140 - total - 8, 140 - base - 8] }} transition={{ duration: 4, times: [0, 0.3, 0.8, 1], delay: i * 0.25, repeat: Infinity, repeatDelay: 0.6 }}>
              {m}x
            </motion.text>
          </g>
        );
      })}
      <text x="16" y="24" fontSize="10" fontFamily="ui-monospace, monospace" fill="rgba(var(--text-rgb),0.4)">deposit</text>
      <rect x="62" y="17" width="10" height="8" rx="2" fill="rgba(var(--text-rgb),0.2)" />
      <text x="82" y="24" fontSize="10" fontFamily="ui-monospace, monospace" fill="rgba(var(--text-rgb),0.4)">flash borrowed</text>
      <rect x="170" y="17" width="10" height="8" rx="2" fill="var(--flash)" />
    </svg>
  );
}

/** Rotate: two tokens trade places along an orbit while the debt bar stays fixed. */
export function RotateArt() {
  const token = (label: string, x: number, fill: string, stroke: string, text: string) => (
    <g transform={`translate(${x} 76)`}>
      <g>
        <animateTransform attributeName="transform" type="rotate" from="360 0 0" to="0 0 0" dur="6s" repeatCount="indefinite" />
        <circle r="18" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <text textAnchor="middle" dy="4" fontSize="10" fontFamily="ui-monospace, monospace" fill={text}>{label}</text>
      </g>
    </g>
  );
  return (
    <svg viewBox="0 0 320 160" className="h-40 w-full" aria-hidden>
      <circle cx="160" cy="76" r="46" fill="none" stroke="rgba(var(--text-rgb),0.12)" className="dash-flow" />
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0 160 76" to="360 160 76" dur="6s" repeatCount="indefinite" />
        {token("NVDA", 114, "var(--surface-2)", "var(--volt)", "var(--volt)")}
        {token("AAPL", 206, "var(--surface-2)", "var(--flash)", "var(--flash)")}
      </g>
      <rect x="114" y="66" width="92" height="20" rx="6" fill="rgba(var(--text-rgb),0.06)" stroke="rgba(var(--text-rgb),0.14)" />
      <text x="160" y="80" textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill="rgba(var(--text-rgb),0.7)">debt 1,000 USDG</text>
      <text x="160" y="152" textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill="rgba(var(--text-rgb),0.4)">collateral moves, loan does not</text>
    </svg>
  );
}

/** Arb: two venue prices drift apart over the weekend band and a spark captures the gap. */
export function ArbArt() {
  const a = "M10 90 C 40 84, 60 96, 90 88 S 140 70, 170 66 S 230 52, 260 46 S 290 40, 310 44";
  const b = "M10 92 C 40 96, 60 88, 90 94 S 140 100, 170 104 S 230 112, 260 118 S 290 122, 310 120";
  return (
    <svg viewBox="0 0 320 160" className="h-40 w-full" aria-hidden>
      <rect x="150" y="16" width="160" height="128" rx="8" fill="rgba(var(--volt-rgb),0.06)" stroke="rgba(var(--volt-rgb),0.2)" />
      <text x="230" y="30" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="rgba(var(--volt-rgb),0.8)" letterSpacing="2">WEEKEND</text>
      <motion.path d={a} fill="none" stroke="var(--up)" strokeWidth="1.5" strokeDasharray="400" style={{ strokeDashoffset: 400 }} initial={{ strokeDashoffset: 400 }} animate={{ strokeDashoffset: [400, 0, 0, 400] }} transition={{ duration: 4, times: [0, 0.55, 0.92, 1], repeat: Infinity, ease: "easeInOut" }} />
      <motion.path d={b} fill="none" stroke="var(--down)" strokeWidth="1.5" strokeDasharray="400" style={{ strokeDashoffset: 400 }} initial={{ strokeDashoffset: 400 }} animate={{ strokeDashoffset: [400, 0, 0, 400] }} transition={{ duration: 4, times: [0, 0.55, 0.92, 1], repeat: Infinity, ease: "easeInOut" }} />
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1, 1, 0] }} transition={{ duration: 4, times: [0, 0.6, 0.65, 0.95, 1], repeat: Infinity }}>
        <line x1="262" x2="262" y1="46" y2="118" stroke="var(--flash)" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M262 62 l-5 12 h6 l-4 12 l9 -16 h-6 l4 -8z" fill="var(--flash)" />
        <rect x="268" y="72" width="44" height="18" rx="5" fill="var(--flash)" />
        <text x="290" y="84" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fontWeight="700" fill="var(--on-flash)">+0.9%</text>
      </motion.g>
      <text x="14" y="150" fontSize="10" fontFamily="ui-monospace, monospace" fill="var(--up)">venue A</text>
      <text x="70" y="150" fontSize="10" fontFamily="ui-monospace, monospace" fill="var(--down)">venue B</text>
    </svg>
  );
}
