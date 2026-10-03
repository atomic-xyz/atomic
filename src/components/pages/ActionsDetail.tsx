"use client";

import Link from "next/link";
import { Pill, Reveal, Ticker } from "@/components/ui/primitives";
import { SectionHead } from "@/components/site/PageShell";
import { ArbArt, LeverageArt, RotateArt } from "@/components/landing/ActionArt";
import { TxVisualizer, type TxStep } from "@/components/landing/TxVisualizer";
import { useSnapshot } from "@/hooks/useSnapshot";
import { fmtPct, fmtUsd } from "@/lib/math";

interface Detail {
  key: string;
  tone: "flash" | "volt" | "up";
  title: string;
  accent: string;
  Art: () => React.JSX.Element;
  summary: string;
  when: string[];
  steps: TxStep[];
  calls: { call: string; note: string }[];
  numbers: (s: ReturnType<typeof useSnapshot>["data"]) => { label: string; value: string; sub?: string }[];
  guardrails: string[];
}

const DETAILS: Detail[] = [
  {
    key: "leverage",
    tone: "flash",
    title: "Perpetual",
    accent: "one deposit, up to 2.6x",
    Art: LeverageArt,
    summary: "You bring USDG. The router flash-borrows the rest, buys the stock on Uniswap, posts it as collateral on Morpho, borrows USDG against it and repays the flash loan. What is left is a leveraged long, opened in one signature.",
    when: ["You want more exposure to a name than your cash allows, without a margin account", "You want the loan priced by an on-chain rate curve instead of a broker's margin rate", "You want the whole position visible and closable on-chain at any hour"],
    steps: [
      { label: "Flash borrow", venue: "Morpho", detail: "USDG equal to exposure minus your deposit" },
      { label: "Swap", venue: "Uniswap v3", detail: "all USDG into the stock, best fee tier" },
      { label: "Supply", venue: "Morpho", detail: "stock as collateral on the deepest market" },
      { label: "Borrow", venue: "Morpho", detail: "USDG against it, capped below liquidation" },
      { label: "Repay", venue: "Morpho", detail: "flash loan closed, zero fee" },
    ],
    calls: [
      { call: "Morpho.flashLoan(USDG, flashAmount, data)", note: "Fee-free, must be repaid before the callback returns" },
      { call: "SwapRouter02.exactInputSingle({ tokenIn: USDG, tokenOut: STOCK, fee, amountOutMinimum })", note: "amountOutMinimum comes from the quote you saw, minus your slippage tolerance" },
      { call: "Morpho.supplyCollateral(market, tokens, onBehalf: you)", note: "Collateral is credited to your address, not the router" },
      { call: "Morpho.borrow(market, debt, onBehalf: you, receiver: router)", note: "Requires a one-time Morpho authorization for the router" },
      { call: "USDG.transfer(Morpho, flashAmount)", note: "Closes the flash loan inside onMorphoFlashLoan" },
    ],
    numbers: (s) => {
      const m = s?.markets.find((x) => x.symbol === "NVDA");
      return [
        { label: "NVDA max leverage", value: m ? `${(1 / (1 - m.lltv)).toFixed(2)}x` : "-", sub: m ? `${fmtPct(m.lltv, 1)} LLTV, app caps at 90% of it` : undefined },
        { label: "NVDA borrow APY", value: m ? fmtPct(m.borrowApy) : "-", sub: "AdaptiveCurve IRM, live" },
        { label: "Idle USDG to borrow", value: m ? fmtUsd(Math.max(0, m.supplyUSDG - m.borrowUSDG)) : "-", sub: "in the NVDA market right now" },
        { label: "Flashable USDG", value: s ? fmtUsd(s.flashLiquidityUSDG) : "-", sub: "idle across all Morpho markets" },
      ];
    },
    guardrails: ["The app refuses to open above 90% of the liquidation threshold", "The swap reverts if output falls below your minimum, and with it the whole transaction", "Borrow is blocked when the market's idle USDG is smaller than your debt"],
  },
  {
    key: "rotate",
    tone: "volt",
    title: "Rotate",
    accent: "swap collateral, keep the loan",
    Art: RotateArt,
    summary: "Move a position from one stock to another without closing it. The router flash-borrows your debt amount, repays it to release the old collateral, swaps that collateral, supplies the new one, borrows the same debt again and repays the flash loan.",
    when: ["You want to rotate sectors, NVDA into AAPL, without cash sitting idle for a settlement cycle", "You are happy with your loan size and only want to change what backs it", "A market for the destination stock has enough idle USDG to re-open your debt"],
    steps: [
      { label: "Flash borrow", venue: "Morpho", detail: "USDG equal to your outstanding debt" },
      { label: "Repay and withdraw", venue: "Morpho", detail: "old debt cleared, old collateral released" },
      { label: "Swap", venue: "Uniswap v3", detail: "old stock into new stock, direct or via USDG" },
      { label: "Supply and borrow", venue: "Morpho", detail: "new collateral in, same debt out" },
      { label: "Repay", venue: "Morpho", detail: "flash loan closed" },
    ],
    calls: [
      { call: "Morpho.flashLoan(USDG, debt, data)", note: "Sized from your live borrow shares" },
      { call: "Morpho.repay(oldMarket, debt, onBehalf: you)", note: "Clears the loan so the collateral can leave" },
      { call: "Morpho.withdrawCollateral(oldMarket, tokens, onBehalf: you, receiver: router)", note: "Router holds the tokens only for this transaction" },
      { call: "SwapRouter02.exactInput(path)", note: "Path is chosen by the quoter: direct, via USDG or via WETH" },
      { call: "Morpho.supplyCollateral(newMarket) then Morpho.borrow(newMarket, debt)", note: "Debt is re-opened at the same USDG amount" },
    ],
    numbers: (s) => {
      const a = s?.markets.find((x) => x.symbol === "NVDA");
      const b = s?.markets.find((x) => x.symbol === "AAPL");
      return [
        { label: "NVDA oracle", value: a ? fmtUsd(a.oraclePrice) : "-", sub: "Morpho oracle, Chainlink backed" },
        { label: "AAPL oracle", value: b ? fmtUsd(b.oraclePrice) : "-", sub: "same source" },
        { label: "AAPL idle USDG", value: b ? fmtUsd(Math.max(0, b.supplyUSDG - b.borrowUSDG)) : "-", sub: "room to re-open debt" },
        { label: "Rate change", value: a && b ? `${fmtPct(a.borrowApy)} to ${fmtPct(b.borrowApy)}` : "-", sub: "NVDA market to AAPL market" },
      ];
    },
    guardrails: ["Blocked when the destination LTV would sit above 98% of its liquidation threshold", "Blocked when the destination market cannot supply your debt", "Slippage on the stock-to-stock leg is bounded by your minimum output"],
  },
  {
    key: "arb",
    tone: "up",
    title: "Arbitrage",
    accent: "zero balance, borrowed inventory",
    Art: ArbArt,
    summary: "The same stock trades in several pools. When one prices it below another by more than both pool fees, the router flash-borrows USDG, buys at the cheap venue, sells at the dear one and repays. Whatever clears is yours, and if nothing clears the transaction reverts and costs only gas.",
    when: ["Weekends and after-hours, when the underlying is closed and pools drift apart", "Right after large trades, before other bots rebalance the pools", "Any time the scanner shows a net spread above zero on a ticker with two or more venues"],
    steps: [
      { label: "Flash borrow", venue: "Morpho", detail: "USDG sized to the opportunity" },
      { label: "Buy", venue: "cheap venue", detail: "stock at the lower price" },
      { label: "Sell", venue: "dear venue", detail: "same stock at the higher price" },
      { label: "Repay", venue: "Morpho", detail: "flash loan closed" },
      { label: "Keep", venue: "you", detail: "the spread after fees and gas" },
    ],
    calls: [
      { call: "Morpho.flashLoan(USDG, size, data)", note: "Or a Uniswap v3 flash if the route needs WETH" },
      { call: "SwapRouter02.exactInputSingle(USDG -> STOCK) on venue A", note: "Uniswap v3 and forks; v4 via the Universal Router" },
      { call: "SwapRouter02.exactInputSingle(STOCK -> USDG) on venue B", note: "amountOutMinimum is set to size plus your minimum profit" },
      { call: "require(profit >= minProfit)", note: "Otherwise revert: no partial fills, no inventory left behind" },
    ],
    numbers: (s) => {
      const multi = s ? Object.values(s.venues.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v.symbol]: (acc[v.symbol] ?? 0) + 1 }), {})).filter((n) => n > 1).length : 0;
      const best = s ? s.venues.slice().sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))[0] : undefined;
      return [
        { label: "Venues scanned", value: s ? String(s.venues.length) : "-", sub: "Uniswap v3, v4 and forks" },
        { label: "Tickers with two or more venues", value: s ? String(multi) : "-", sub: "pairwise spreads computed" },
        { label: "Widest deviation now", value: best ? `${best.symbol} ${best.deviation >= 0 ? "+" : ""}${fmtPct(best.deviation)}` : "-", sub: best ? `vs Chainlink at ${fmtUsd(best.price)}` : undefined },
        { label: "Refresh", value: "10s", sub: "every venue re-read from chain" },
      ];
    },
    guardrails: ["Net spread ignores price impact, so size stays small until the router simulates the exact fill", "A minimum-profit check makes an unprofitable attempt revert instead of executing", "Gas is the only cost of a failed attempt"],
  },
];

export function ActionsDetail() {
  const { data } = useSnapshot();
  return (
    <>
      {DETAILS.map((d, i) => (
        <section key={d.key} id={d.key} className={`relative overflow-hidden border-b border-line ${i % 2 ? "bg-bg-2/40" : ""}`}>
          <div className="pointer-events-none absolute left-[-4%] top-6 hidden select-none font-display text-[18vw] italic leading-none outline-text lg:block">0{i + 1}</div>
          <div className="relative mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <div className="flex items-center gap-3">
                <Pill tone={d.tone}>{d.title}</Pill>
                <span className="font-mono text-[11px] text-muted-2">action 0{i + 1}</span>
              </div>
              <h2 className="mt-5 text-4xl leading-[1.02] tracking-[-0.02em] md:text-6xl">
                {d.title}. <span className="font-display italic text-muted">{d.accent}</span>
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-8">
                <Reveal delay={0.05}>
                  <p className="max-w-2xl text-lg leading-relaxed text-muted">{d.summary}</p>
                </Reveal>
                <Reveal delay={0.1} className="overflow-hidden rounded-3xl border border-line bg-surface/60">
                  <d.Art />
                </Reveal>
                <Reveal delay={0.12}>
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">When to use it</div>
                  <ul className="mt-4 grid gap-2">
                    {d.when.map((w) => (
                      <li key={w} className="flex items-start gap-3 rounded-2xl border border-line bg-bg/40 px-4 py-3 text-sm text-muted">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-flash" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal delay={0.14}>
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">Live numbers</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {d.numbers(data).map((n) => (
                      <div key={n.label} className="rounded-2xl border border-line bg-bg/40 p-4">
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">{n.label}</div>
                        <div className="mt-1.5 font-mono text-xl tabular">{data ? n.value : <span className="skeleton inline-block h-5 w-24" />}</div>
                        {n.sub && <div className="mt-0.5 font-mono text-[11px] text-muted">{n.sub}</div>}
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>

              <div className="grid gap-6 self-start lg:sticky lg:top-24">
                <Reveal delay={0.08}>
                  <TxVisualizer steps={d.steps} title={`${d.title} recipe`} compact />
                </Reveal>
                <Reveal delay={0.12} className="rounded-3xl border border-line bg-surface/60 p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">Contract calls, in order</div>
                  <ol className="mt-4 grid gap-3">
                    {d.calls.map((c, j) => (
                      <li key={c.call} className="grid grid-cols-[20px_1fr] gap-3">
                        <span className="font-mono text-[10px] text-muted-2">{String(j + 1).padStart(2, "0")}</span>
                        <div>
                          <div className="break-all font-mono text-xs text-flash">{c.call}</div>
                          <div className="mt-1 text-xs text-muted">{c.note}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Reveal>
                <Reveal delay={0.14} className="rounded-3xl border border-line bg-surface/60 p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">Guardrails</div>
                  <ul className="mt-3 grid gap-2 text-sm text-muted">
                    {d.guardrails.map((g) => <li key={g} className="flex gap-2"><span className="text-flash">/</span>{g}</li>)}
                  </ul>
                  <Link href={`/app?tab=${d.key}`} className="btn-flash mt-5 inline-flex rounded-full px-5 py-2.5 text-sm">
                    Open {d.title.toLowerCase()} in the app
                  </Link>
                </Reveal>
              </div>
            </div>
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <SectionHead eyebrow="Which stocks" title="Every action needs a live market" accent="or a live pool" />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.markets ?? []).map((m) => (
            <div key={m.id} className="card flex items-center gap-4 p-4">
              <Ticker symbol={m.symbol} size="lg" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.symbol}</span>
                  <span className="font-mono text-xs text-flash">{(1 / (1 - m.lltv)).toFixed(2)}x</span>
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-muted">
                  <span>{fmtUsd(m.oraclePrice)}</span>
                  <span>{fmtPct(m.borrowApy)} APY</span>
                </div>
              </div>
            </div>
          ))}
          {!data && Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
        <p className="mt-4 font-mono text-[11px] text-muted-2">Leverage and rotate need a Morpho market with USDG supply. Arb only needs two venues pricing the same token.</p>
      </section>
    </>
  );
}
