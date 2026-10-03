"use client";

import Link from "next/link";
import { Eyebrow, Pill, Reveal } from "@/components/ui/primitives";
import { TiltCard } from "@/components/ui/effects";
import { ArbArt, LeverageArt, RotateArt } from "./ActionArt";

const ACTIONS = [
  {
    key: "leverage",
    title: "Perpetual",
    tagline: "Long a stock 2x to 2.6x with one deposit",
    body: "Deposit USDG, pick a multiple. ATOMIC flash-borrows the rest, buys the stock on Uniswap, posts it to Morpho, borrows against it and repays the flash loan. No loops, no five-tab dance.",
    steps: ["Flash USDG", "Buy stock", "Supply", "Borrow", "Repay"],
    tone: "flash" as const,
    Art: LeverageArt,
  },
  {
    key: "rotate",
    title: "Rotate",
    tagline: "Swap NVDA collateral for AAPL, loan untouched",
    body: "Sector rotation without closing the position. Flash-borrow, withdraw the old collateral, swap it, supply the new one, repay. Your debt never moves and your position never leaves the block.",
    steps: ["Flash USDG", "Withdraw", "Swap", "Supply", "Repay"],
    tone: "volt" as const,
    Art: RotateArt,
  },
  {
    key: "arb",
    title: "Arbitrage",
    tagline: "Trade the weekend gap with a zero balance",
    body: "Stocks close Friday, their tokens do not. Pools drift apart. The scanner watches every venue against Chainlink and, when a spread clears both fees, executes buy-low-sell-high with borrowed inventory.",
    steps: ["Flash USDG", "Buy cheap", "Sell dear", "Repay", "Keep spread"],
    tone: "up" as const,
    Art: ArbArt,
  },
];

export function Actions() {
  return (
    <section id="actions" className="relative overflow-hidden px-5 py-24 md:px-8 md:py-32"><div className="relative mx-auto max-w-7xl">
      <div className="pointer-events-none absolute left-[-10%] top-10 hidden select-none font-display text-[22vw] italic leading-none outline-text lg:block">01</div>
      <Reveal>
        <Eyebrow>Three actions, one transaction each</Eyebrow>
      </Reveal>
      <Reveal delay={0.05} className="flex flex-wrap items-end justify-between gap-6">
        <h2 className="mt-6 max-w-3xl text-4xl leading-[1.02] tracking-[-0.02em] md:text-6xl">
          Wall Street needs a prime broker to do this.
          <span className="font-display italic text-muted"> You need one signature</span>
        </h2>
        <Link href="/actions" className="btn-ghost rounded-full px-5 py-2.5 text-sm">Every action in detail</Link>
      </Reveal>

      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {ACTIONS.map((a, i) => (
          <Reveal key={a.key} delay={i * 0.08}>
            <TiltCard className="group h-full rounded-[20px]" intensity={7}>
              <div className="card relative flex h-full flex-col overflow-hidden p-6">
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72" style={{ background: `radial-gradient(closest-side, ${a.tone === "flash" ? "rgba(var(--flash-rgb),0.18)" : a.tone === "volt" ? "rgba(var(--volt-rgb),0.22)" : "rgba(var(--up-rgb),0.18)"}, transparent 70%)` }} />
                <div className="flex items-center justify-between">
                  <Pill tone={a.tone}>{a.title}</Pill>
                  <span className="font-mono text-[11px] text-muted-2">0{i + 1}</span>
                </div>
                <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-bg/60">
                  <a.Art />
                </div>
                <h3 className="mt-6 text-2xl leading-tight tracking-tight">{a.tagline}</h3>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted">{a.body}</p>
                <div className="mt-6 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted">
                  {a.steps.map((s, j) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span className="rounded-md border border-line bg-bg/60 px-2 py-1">{s}</span>
                      {j < a.steps.length - 1 && <span className="text-muted-2">/</span>}
                    </span>
                  ))}
                </div>
                <Link href={`/app?tab=${a.key}`} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-text transition-colors hover:text-flash">
                  Open {a.title.toLowerCase()}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-1"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
              </div>
            </TiltCard>
          </Reveal>
        ))}
      </div>
      </div>
    </section>
  );
}
