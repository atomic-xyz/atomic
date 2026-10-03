"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Eyebrow } from "@/components/ui/primitives";
import { SplitWords } from "@/components/ui/effects";
import { TxVisualizer } from "./TxVisualizer";
import { HeroCanvas } from "./HeroCanvas";
import { BlockClock } from "./BlockClock";
import { useSnapshot } from "@/hooks/useSnapshot";
import { fmtUsd } from "@/lib/math";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { data } = useSnapshot();
  const chips = data
    ? Object.values(data.feeds).slice(0, 6).map((f) => ({ symbol: f.symbol, price: f.price }))
    : [];

  return (
    <section className="relative min-h-[100svh] overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="aurora" />
      <div className="absolute inset-0">
        <HeroCanvas />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, delay: 0.2, ease }}
        className="pointer-events-none absolute right-[-8%] top-[-4%] hidden w-[58vw] max-w-[900px] select-none lg:block"
        aria-hidden
      >
        <div className="hero-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/atomic-sphere-alpha-1024.png" alt="" width={1024} height={1024} className="h-auto w-full" draggable={false} />
        </div>
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(var(--flash-rgb),0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-bg/90 via-bg/55 to-transparent md:w-[58%]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-bg to-transparent" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 md:grid-cols-[1.05fr_0.95fr] md:px-8">
        <div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="flex flex-wrap items-center gap-4">
            <Eyebrow>Execution layer for stock tokens</Eyebrow>
            <BlockClock className="text-[11px]" />
          </motion.div>

          <h1 className="hero-h1 mt-7 text-[44px] leading-[0.95] tracking-[-0.035em] sm:text-[56px] md:text-[64px] lg:text-[76px]">
            <SplitWords text="Borrow, swap, repay" delay={0.1} />
            <br />
            <span className="font-display text-gradient">
              <SplitWords text="one transaction," delay={0.35} />
            </span>
            <br />
            <SplitWords text="zero capital" delay={0.55} className="text-sheen" />
          </h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8, ease }} className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
            Leverage NVDA, rotate into AAPL or arb the weekend gap. ATOMIC composes flash liquidity from Morpho and Uniswap into a single block on Robinhood Chain. If any step fails, nothing happened.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.95, ease }} className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/app" className="btn-flash group relative overflow-hidden rounded-full px-7 py-3.5 text-sm">
              <span className="relative z-10">Open the app</span>
              <span className="absolute inset-0 -translate-x-full bg-text/40 transition-transform duration-500 group-hover:translate-x-full" style={{ clipPath: "polygon(20% 0, 40% 0, 20% 100%, 0 100%)" }} />
            </Link>
            <a href="#how" className="btn-ghost rounded-full px-7 py-3.5 text-sm backdrop-blur">
              See how it works
            </a>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.2 }} className="mt-10 flex flex-wrap gap-2">
            {(chips.length ? chips : Array.from({ length: 6 }, () => null)).map((c, i) => (
              <motion.span
                key={c ? c.symbol : i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + i * 0.07 }}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-bg/60 px-3 py-1.5 font-mono text-[11px] backdrop-blur"
              >
                {c ? (
                  <>
                    <span className="text-text">{c.symbol}</span>
                    <span className="text-muted">{fmtUsd(c.price)}</span>
                    <span className="h-1 w-1 rounded-full bg-up" />
                  </>
                ) : (
                  <span className="skeleton h-3 w-20" />
                )}
              </motion.span>
            ))}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1, delay: 0.5, ease }} className="float-slow">
          <div className="beam-border rounded-[26px] p-px">
            <TxVisualizer />
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 1 }} className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 md:flex">
        <span className="h-px w-10 bg-line-2" />
        every block is 100ms, scroll to see what fits in one
        <span className="h-px w-10 bg-line-2" />
      </motion.div>
    </section>
  );
}
