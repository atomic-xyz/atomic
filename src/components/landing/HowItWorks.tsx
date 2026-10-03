"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eyebrow, Reveal } from "@/components/ui/primitives";
import { ADDR } from "@/lib/addresses";
import { shortAddr } from "@/lib/math";
import { TraceTerminal } from "./TraceTerminal";

const STEPS = [
  {
    n: "01",
    title: "Flash borrow from Morpho",
    body: "Morpho lends any idle USDG for the duration of one transaction at zero fee. Uniswap v3 pools are the fallback source when a route needs a different token.",
    addr: ADDR.MORPHO,
  },
  {
    n: "02",
    title: "Swap on Uniswap",
    body: "The router quotes every v3 fee tier plus two-hop routes through WETH and USDG and takes the best output. Slippage is bounded by the minimum you set in the app.",
    addr: ADDR.UNI_V3_SWAP_ROUTER_02,
  },
  {
    n: "03",
    title: "Supply and borrow on Morpho",
    body: "The stock goes in as collateral on the deepest live market for that ticker. USDG comes out against it, priced by the Chainlink-backed Morpho oracle.",
    addr: ADDR.MORPHO,
  },
  {
    n: "04",
    title: "Repay inside the callback",
    body: "The borrowed USDG repays the flash loan before the callback returns. If the numbers do not close, the whole transaction reverts and your wallet is exactly as it was.",
    addr: ADDR.MORPHO,
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const pathname = usePathname();
  return (
    <section id="how" className="relative overflow-hidden border-y border-line bg-bg-2/40">
      <div className="pointer-events-none absolute right-[-4%] bottom-0 hidden select-none font-display text-[22vw] italic leading-none outline-text lg:block">02</div>
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-32">
        <div>
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 text-4xl leading-[1.02] tracking-[-0.02em] md:text-5xl">
              Every step is a call.
              <br />
              Every call is in <span className="font-display italic text-flash">one block</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              ATOMIC holds no deposits and runs no pool. It borrows liquidity that already exists, uses it for a single block and hands it back. The protocol sells one thing: execution.
            </p>
            {pathname === "/" && <Link href="/how-it-works" className="btn-ghost mt-6 inline-flex rounded-full px-5 py-2.5 text-sm">Architecture, contracts and FAQ</Link>}
          </Reveal>
          <div className="mt-10 grid gap-2">
            {STEPS.map((s, i) => (
              <div key={s.n} className={`rounded-2xl border px-4 py-3 transition-all duration-300 ${active === i ? "border-flash/40 bg-flash/5" : "border-line"}`}>
                <div className="flex items-center gap-4">
                  <span className={`font-mono text-xs ${active === i ? "text-flash" : "text-muted-2"}`}>{s.n}</span>
                  <span className={`text-sm font-medium ${active === i ? "text-text" : "text-muted"}`}>{s.title}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-2">{shortAddr(s.addr)}</span>
                </div>
                <div className={`grid transition-all duration-300 ${active === i ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <p className="overflow-hidden text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Reveal delay={0.1} className="relative">
          <div className="sticky top-28">
            <TraceTerminal activeStep={active} onStep={setActive} />
            <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-2">
              <span>live NVDA price and block number from the snapshot</span>
              <span>revert on any failure</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
