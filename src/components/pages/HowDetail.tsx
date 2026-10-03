"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal } from "@/components/ui/primitives";
import { SectionHead } from "@/components/site/PageShell";
import { ADDR, EXPLORER } from "@/lib/addresses";
import { shortAddr } from "@/lib/math";

const PILLARS = [
  {
    title: "Flash liquidity that already exists",
    body: "Morpho's core contract lends any idle USDG for the length of one transaction at zero fee. Uniswap v3 pools offer the same for their own tokens at the pool fee. ATOMIC never asks anyone to deposit; it borrows from these, uses the money for a single block and returns it.",
    stat: "0 bps",
    statLabel: "Morpho flash fee",
  },
  {
    title: "One router, no state",
    body: "The router holds nothing between transactions. It receives your calldata, runs the recipe inside the flash-loan callback and ends every path by repaying. Positions live on Morpho under your own address, so the router can vanish tomorrow and your loan is untouched.",
    stat: "0",
    statLabel: "USDG held by the router",
  },
  {
    title: "Revert is the safety net",
    body: "Every step can fail: a swap below minimum, a borrow above the liquidation threshold, a spread that closed. Any failure reverts the entire transaction, so you either get the full outcome you signed for or exactly the state you started from, minus gas.",
    stat: "1",
    statLabel: "block, all or nothing",
  },
];

const ADDRESSES = [
  { name: "Morpho", addr: ADDR.MORPHO, role: "Flash loans, collateral, borrowing" },
  { name: "Morpho AdaptiveCurve IRM", addr: ADDR.MORPHO_IRM, role: "Borrow rate per market" },
  { name: "Morpho Bundler3", addr: ADDR.MORPHO_BUNDLER3, role: "Reference for multicall patterns" },
  { name: "Uniswap v3 SwapRouter02", addr: ADDR.UNI_V3_SWAP_ROUTER_02, role: "Executes swaps" },
  { name: "Uniswap v3 QuoterV2", addr: ADDR.UNI_V3_QUOTER_V2, role: "Quotes every fee tier before you sign" },
  { name: "Uniswap v3 Factory", addr: ADDR.UNI_V3_FACTORY, role: "Pool discovery" },
  { name: "Uniswap v4 PoolManager", addr: ADDR.UNI_V4_POOL_MANAGER, role: "v4 pools, priced via StateView" },
  { name: "Uniswap v4 StateView", addr: ADDR.UNI_V4_STATE_VIEW, role: "slot0 and liquidity for v4 pools" },
  { name: "Universal Router", addr: ADDR.UNIVERSAL_ROUTER, role: "v4 swaps" },
  { name: "Permit2", addr: ADDR.PERMIT2, role: "Token approvals" },
  { name: "USDG", addr: ADDR.USDG, role: "The only loan asset on live stock markets" },
  { name: "WETH", addr: ADDR.WETH, role: "Gas token wrapper, two-hop routes" },
  { name: "Stock token factory", addr: ADDR.STOCK_FACTORY, role: "Deploys every stock token" },
  { name: "Chainlink ETH / USD", addr: ADDR.FEED_ETH_USD, role: "Prices WETH-quoted pools" },
  { name: "Chainlink USDG / USD", addr: ADDR.FEED_USDG_USD, role: "Prices USDG-quoted pools" },
];

const FAQ = [
  { q: "Do I deposit anything into ATOMIC?", a: "No. Your deposit for a leverage goes straight into the recipe and ends up as collateral on Morpho under your address. The router never keeps a balance." },
  { q: "What do I have to approve?", a: "A USDG allowance for your deposit, and a one-time Morpho authorization that lets the router borrow and withdraw on your behalf inside the transaction. You can revoke it at any time on Morpho." },
  { q: "What happens if the swap gets a bad price?", a: "The quote you see sets a minimum output. If the pool cannot deliver it when the transaction lands, the swap reverts and so does everything else. You pay gas and nothing changes." },
  { q: "Why Morpho for the flash loan and not Uniswap?", a: "Morpho's flash loan is free and sized to all idle USDG across its markets, roughly fifty million dollars. Uniswap v3 flash costs the pool fee. The router uses Uniswap only when a route needs WETH inventory." },
  { q: "Who liquidates me?", a: "Morpho's liquidators, against the Chainlink-backed oracle of the market you are in. ATOMIC does not run a liquidation bot and cannot stop one." },
  { q: "Where does the fee go?", a: "A small fee on the flash amount is planned, taken inside the transaction. It is zero while the router is in preview and will be published before execution opens." },
];

export function HowDetail() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <>
      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <SectionHead eyebrow="Three principles" title="No pool, no custody," accent="no partial outcomes" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06} className="card relative overflow-hidden p-7">
              <div className="font-mono text-5xl tabular text-flash">{p.stat}</div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">{p.statLabel}</div>
              <h3 className="mt-6 text-xl tracking-tight">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-bg-2/40">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
          <SectionHead eyebrow="Routing" title="Every fee tier, every hop," accent="best output wins" />
          <div className="mt-12 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Reveal className="card p-7">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">What the quoter tries</div>
              <ul className="mt-4 grid gap-3 text-sm text-muted">
                <li className="flex gap-3"><span className="font-mono text-flash">01</span>Direct pool at 0.01%, 0.05%, 0.30% and 1.00%</li>
                <li className="flex gap-3"><span className="font-mono text-flash">02</span>Two hops through WETH, nine fee combinations</li>
                <li className="flex gap-3"><span className="font-mono text-flash">03</span>Two hops through USDG for stock-to-stock rotations</li>
                <li className="flex gap-3"><span className="font-mono text-flash">04</span>All of it in one multicall, sorted by output, refreshed every twelve seconds while you edit</li>
              </ul>
            </Reveal>
            <Reveal delay={0.08} className="card p-7">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">What the snapshot reads every ten seconds</div>
              <ul className="mt-4 grid gap-3 text-sm text-muted">
                <li className="flex gap-3"><span className="font-mono text-flash">/</span>Chainlink feeds for every tradable ticker, ETH and USDG</li>
                <li className="flex gap-3"><span className="font-mono text-flash">/</span>slot0 and liquidity on every stock pool, v3 forks included, v4 through StateView</li>
                <li className="flex gap-3"><span className="font-mono text-flash">/</span>Morpho market totals, oracle prices and the IRM borrow rate</li>
                <li className="flex gap-3"><span className="font-mono text-flash">/</span>Idle USDG held by Morpho, which is the flash-loan ceiling</li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <SectionHead eyebrow="On-chain" title="Contracts the router talks to" accent="all on Robinhood Chain">
          <span className="font-mono text-[11px] text-muted">gas paid in ETH</span>
        </SectionHead>
        <Reveal className="mt-10 overflow-hidden rounded-3xl border border-line">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-bg-2/80 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-2">
                <tr>
                  <th className="px-5 py-3 text-left font-normal">Contract</th>
                  <th className="px-5 py-3 text-left font-normal">Address</th>
                  <th className="px-5 py-3 text-left font-normal">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ADDRESSES.map((a) => (
                  <tr key={a.addr} className="transition-colors hover:bg-text/[0.02]">
                    <td className="px-5 py-3 font-medium">{a.name}</td>
                    <td className="px-5 py-3 font-mono text-xs">
                      <a href={`${EXPLORER}/address/${a.addr}`} target="_blank" rel="noreferrer" className="text-flash hover:underline">{shortAddr(a.addr)}</a>
                      <span className="ml-2 hidden text-muted-2 xl:inline">{a.addr}</span>
                    </td>
                    <td className="px-5 py-3 text-muted">{a.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <section className="border-t border-line bg-bg-2/40">
        <div className="mx-auto max-w-4xl px-5 py-20 md:px-8 md:py-28">
          <SectionHead eyebrow="Questions" title="Things people ask" accent="before they sign" />
          <div className="mt-10 grid gap-2">
            {FAQ.map((f, i) => (
              <div key={f.q} className={`rounded-2xl border transition-colors ${open === i ? "border-flash/40 bg-flash/5" : "border-line"}`}>
                <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="text-[15px] font-medium">{f.q}</span>
                  <span className={`font-mono text-muted transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
