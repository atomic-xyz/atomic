"use client";

import { Reveal } from "@/components/ui/primitives";
import { SectionHead } from "@/components/site/PageShell";

const GROUPS = [
  {
    title: "The asset",
    items: [
      { t: "Issuer risk", b: "Stock tokens are debt securities issued by Robinhood Assets (Jersey) Limited. They track a share, they are not the share. If the issuer fails, the token does too, and no on-chain mechanism changes that." },
      { t: "No voting, dividends as a multiplier", b: "Holders get no voting rights. Dividends are reinvested into the underlying and expressed as a growing token multiplier rather than a cash payment." },
      { t: "Eligibility", b: "Robinhood blocks US, UK, Canadian and Swiss persons, and residents of several other jurisdictions, from holding stock tokens. ATOMIC does not change who is allowed to hold what, and the router will not check for you." },
    ],
  },
  {
    title: "The market",
    items: [
      { t: "Weekend drift", b: "Tokens trade 24/7 while the underlying trades 6.5 hours a day. Over a weekend pools drift from the last close and reprice sharply at the Monday open. A leveraged position opened Friday can be liquidated before you are awake." },
      { t: "Oracle and liquidation", b: "Morpho liquidates against a Chainlink-backed oracle, not against the pool you traded in. A pool can be calm while the oracle moves, or the reverse. Liquidation bonuses on stock markets are meaningful." },
      { t: "Thin books", b: "Several markets carry only a few hundred thousand USDG and several pools under a million dollars. A large leverage or rotation moves the price against you; the app shows the quote before you sign, but the quote is not a guarantee." },
      { t: "Rate changes", b: "Borrow APY follows an adaptive curve. It is low while utilisation is low and can rise fast when a market fills up." },
    ],
  },
  {
    title: "The stack",
    items: [
      { t: "Router contract", b: "ATOMIC composes Morpho and Uniswap, both audited. The router itself is new code. It will be published, verified on Blockscout and audited before mainnet execution opens, and until then the app is simulation only." },
      { t: "Authorization", b: "Rotate and leverage need a Morpho authorization for the router so it can borrow and withdraw on your behalf inside one transaction. Revoke it on Morpho when you are done." },
      { t: "Single sequencer", b: "Robinhood runs the only sequencer. A halt stops every transaction on the chain, including liquidations and your exits, until it resumes." },
      { t: "Front ends and RPCs", b: "The interface reads from public RPC endpoints and falls back between them. Numbers can be seconds stale. Nothing in the interface can move funds without your signature." },
    ],
  },
];

export function RisksFull() {
  return (
    <>
      {GROUPS.map((g, gi) => (
        <section key={g.title} className={`border-b border-line ${gi % 2 ? "bg-bg-2/40" : ""}`}>
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:grid-cols-[0.35fr_0.65fr] md:px-8 md:py-24">
            <div>
              <SectionHead eyebrow={`0${gi + 1}`} title={g.title} />
            </div>
            <div className="grid gap-3">
              {g.items.map((it, i) => (
                <Reveal key={it.t} delay={i * 0.05} className="card p-6">
                  <h3 className="text-lg font-medium">{it.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{it.b}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ))}
      <section className="mx-auto max-w-4xl px-5 py-20 md:px-8 md:py-24">
        <div className="rounded-3xl border border-warn/40 bg-warn/5 p-7">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-warn">Plain language</div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            ATOMIC is software that composes existing protocols. It is not a broker, an exchange, an adviser or a custodian, and nothing on this site is a recommendation to buy, sell or borrow anything. Leverage can lose more than the deposit. Use it only with money you can afford to lose and only if you are allowed to hold the assets involved.
          </p>
        </div>
      </section>
    </>
  );
}
