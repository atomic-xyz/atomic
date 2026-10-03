"use client";

import Link from "next/link";
import { Eyebrow, Reveal } from "@/components/ui/primitives";

const RISKS = [
  {
    title: "Issuer risk",
    body: "Stock tokens are debt securities issued by Robinhood Assets (Jersey). They track a share, they are not the share. If the issuer fails, the token does too.",
  },
  {
    title: "Eligibility",
    body: "Robinhood blocks US, UK, Canadian and Swiss persons from holding stock tokens. ATOMIC does not change who is allowed to hold what.",
  },
  {
    title: "Oracle and liquidation",
    body: "Morpho liquidates against a Chainlink-backed oracle. Tokens can drift from the official close over a weekend and reprice sharply when markets reopen.",
  },
  {
    title: "Thin books",
    body: "Some markets carry a few hundred thousand USDG. Slippage on a large leverage or rotation can be real, and the app shows you the quote before you sign.",
  },
  {
    title: "Contract risk",
    body: "ATOMIC composes Morpho and Uniswap, both audited. The router itself is new code and will be published, verified and audited before mainnet execution opens.",
  },
  {
    title: "Single sequencer",
    body: "Robinhood runs the only sequencer. A halt stops every transaction on the chain, including liquidations and your exits.",
  },
];

export function Risks() {
  return (
    <section id="risks" className="border-t border-line bg-bg-2/40">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <Eyebrow>Read before you sign</Eyebrow>
        </Reveal>
        <Reveal delay={0.05} className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="mt-6 max-w-2xl text-4xl leading-[1.02] tracking-[-0.02em] md:text-5xl">
            Atomic means it either happens or it does not.
            <span className="font-display italic text-muted"> It does not mean safe</span>
          </h2>
          <Link href="/risks" className="btn-ghost rounded-full px-5 py-2.5 text-sm">The full risk page</Link>
        </Reveal>
        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {RISKS.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.05} className="bg-bg p-7">
              <div className="font-mono text-[11px] text-muted-2">0{i + 1}</div>
              <h3 className="mt-3 text-lg font-medium">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{r.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
