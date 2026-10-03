"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { fmtUsd } from "@/lib/math";

/**
 * Equity of the leveraged position across a range of prices, with the liquidation line
 * and the current oracle price marked. Pure SVG, animated with framer-motion.
 */
export function PositionChart({ tokens, debt, price, liqPrice, deposit, symbol }: { tokens: number; debt: number; price: number; liqPrice: number; deposit: number; symbol: string }) {
  const W = 640, H = 220, padL = 52, padR = 16, padT = 18, padB = 30;
  const model = useMemo(() => {
    if (!(tokens > 0 && price > 0)) return null;
    const lo = price * 0.55, hi = price * 1.45;
    const pts: { p: number; eq: number }[] = [];
    for (let i = 0; i <= 60; i++) {
      const p = lo + ((hi - lo) * i) / 60;
      pts.push({ p, eq: Math.max(0, tokens * p - debt) });
    }
    const eqMax = Math.max(...pts.map((x) => x.eq), deposit * 1.2);
    const X = (p: number) => padL + ((p - lo) / (hi - lo)) * (W - padL - padR);
    const Y = (e: number) => padT + (1 - e / eqMax) * (H - padT - padB);
    const d = pts.map((x, i) => `${i ? "L" : "M"}${X(x.p).toFixed(1)} ${Y(x.eq).toFixed(1)}`).join(" ");
    const area = `${d} L${X(hi).toFixed(1)} ${Y(0)} L${X(lo).toFixed(1)} ${Y(0)} Z`;
    return { lo, hi, X, Y, d, area, eqMax };
  }, [tokens, debt, price, deposit]);

  if (!model) return <div className="skeleton h-[220px] w-full rounded-2xl" />;
  const { lo, hi, X, Y, d, area, eqMax } = model;
  const liqX = liqPrice > lo && liqPrice < hi ? X(liqPrice) : null;
  const ticks = [0.6, 0.8, 1, 1.2, 1.4].map((m) => price * m);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Equity of the ${symbol} position across prices`}>
      <defs>
        <linearGradient id="eq-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--flash)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--flash)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="liq-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--down)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--down)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - padR} y1={Y(eqMax * f)} y2={Y(eqMax * f)} stroke="rgba(var(--text-rgb),0.06)" />
          <text x={padL - 8} y={Y(eqMax * f) + 3} textAnchor="end" fontSize="9" fontFamily="ui-monospace, monospace" fill="rgba(var(--text-rgb),0.35)">{fmtUsd(eqMax * f, 0)}</text>
        </g>
      ))}
      {ticks.map((p) => (
        <text key={p} x={X(p)} y={H - 10} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="rgba(var(--text-rgb),0.35)">{fmtUsd(p, 0)}</text>
      ))}
      {liqX !== null && <rect x={padL} y={padT} width={Math.max(0, liqX - padL)} height={H - padT - padB} fill="url(#liq-fill)" />}
      <motion.path d={area} fill="url(#eq-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      <motion.path d={d} fill="none" stroke="var(--flash)" strokeWidth="2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      <line x1={padL} x2={W - padR} y1={Y(deposit)} y2={Y(deposit)} stroke="rgba(var(--text-rgb),0.35)" strokeDasharray="3 4" />
      <text x={W - padR} y={Y(deposit) - 4} textAnchor="end" fontSize="9" fontFamily="ui-monospace, monospace" fill="rgba(var(--text-rgb),0.5)">break even {fmtUsd(deposit, 0)}</text>
      {liqX !== null && (
        <g>
          <line x1={liqX} x2={liqX} y1={padT} y2={H - padB} stroke="var(--down)" strokeWidth="1.5" strokeDasharray="4 4" />
          <rect x={liqX - 36} y={padT} width="72" height="16" rx="4" fill="var(--down)" />
          <text x={liqX} y={padT + 11} textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="ui-monospace, monospace" fill="var(--on-flash)">liq {fmtUsd(liqPrice, 0)}</text>
        </g>
      )}
      <motion.g animate={{ x: X(price) }} transition={{ type: "spring", stiffness: 120, damping: 20 }}>
        <line x1={0} x2={0} y1={padT} y2={H - padB} stroke="rgba(var(--text-rgb),0.5)" />
        <circle cx={0} cy={Y(Math.max(0, tokens * price - debt))} r="5" fill="var(--bg)" stroke="var(--flash)" strokeWidth="2" />
        <rect x={-30} y={H - padB - 18} width="60" height="16" rx="4" fill="rgba(var(--text-rgb),0.9)" />
        <text x={0} y={H - padB - 7} textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="ui-monospace, monospace" fill="var(--on-flash)">now {fmtUsd(price, 0)}</text>
      </motion.g>
    </svg>
  );
}
