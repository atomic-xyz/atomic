"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { erc20Abi, type Address } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { useQuote, useSnapshot } from "@/hooks/useSnapshot";
import { useHolderStatus, usePositions, useRouterAuthorized, useUsdgAllowance, useUsdgBalance } from "@/hooks/useOnchain";
import { ADDR } from "@/lib/addresses";
import { stockBySymbol, STOCKS } from "@/lib/data";
import { saveEntry } from "@/lib/entries";
import { fmtNum, fmtPct, fmtUsd, planLeverage } from "@/lib/math";
import { marketParams, morphoAbi, ROUTER_ABI, ROUTER_ADDRESS, routeToPath, withSlippage } from "@/lib/router";
import { Ticker } from "@/components/ui/primitives";
import { StepList } from "./shared";
import { ExecuteFlow, type FlowStep } from "./ExecuteFlow";
import { PositionChart } from "./PositionChart";

const SAFETY = 0.9; // never open above 90% of the liquidation threshold

const MODES = [
  { key: "careful", label: "Careful", mult: 1.5, blurb: "a little leverage, lots of room" },
  { key: "balanced", label: "Balanced", mult: 2, blurb: "double, still a healthy buffer" },
  { key: "bold", label: "Bold", mult: Infinity, blurb: "the most allowed, thin buffer" },
] as const;

export function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-flash font-mono text-xs font-semibold text-[var(--on-flash)]">{n}</span>
      <h2 className="text-lg font-semibold tracking-tight md:text-xl">{children}</h2>
    </div>
  );
}

export function LeveragePanel() {
  const { data } = useSnapshot();
  const { address, isConnected } = useAccount();
  const markets = useMemo(() => data?.markets ?? [], [data]);
  const symbols = useMemo(() => Array.from(new Set(markets.map((m) => m.symbol))), [markets]);
  const [picked, setSymbol] = useState("NVDA");
  const [deposit, setDeposit] = useState("1000");
  const [leverage, setLeverage] = useState(2);
  const [showDetails, setShowDetails] = useState(false);
  const symbol = symbols.length && !symbols.includes(picked) ? symbols[0] : picked;

  // the deepest market for the picked symbol
  const market = useMemo(() => markets.filter((m) => m.symbol === symbol).sort((a, b) => b.supplyUSDG - b.borrowUSDG - (a.supplyUSDG - a.borrowUSDG))[0], [markets, symbol]);
  const stock = stockBySymbol(symbol);
  const feed = data?.feeds[symbol]?.price ?? 0;
  const lltv = market?.lltv ?? 0.625;
  const maxLev = Math.floor((1 / (1 - lltv * SAFETY)) * 100) / 100;
  const dep = Math.max(0, parseFloat(deposit) || 0);
  const lev = Math.min(leverage, maxLev);
  const exposure = dep * lev;
  const balance = useUsdgBalance();
  const walletUsdg = balance.data !== undefined ? Number(balance.data) / 1e6 : null;

  const amountIn = useMemo(() => BigInt(Math.round(exposure * 1e6)), [exposure]);
  const quote = useQuote(ADDR.USDG, stock?.address, amountIn);
  const tokensOut = quote.data?.best ? Number(BigInt(quote.data.best.amountOut)) / 1e18 : 0;
  const execPrice = tokensOut > 0 ? exposure / tokensOut : market?.oraclePrice ?? feed;
  const oraclePrice = market?.oraclePrice || feed || execPrice;
  const plan = planLeverage(dep, lev, lltv, execPrice, oraclePrice);
  const impact = feed > 0 && tokensOut > 0 ? execPrice / feed - 1 : 0;
  const apy = market?.borrowApy ?? 0;
  const yearlyCost = plan.debt * apy;
  const holder = useHolderStatus();
  const oneTimeFee = holder.isHolder ? 0 : plan.flash * (holder.feeBps / 10_000);
  const dropToLiq = oraclePrice > 0 && plan.liqPrice > 0 ? 1 - plan.liqPrice / oraclePrice : 0;
  const route = quote.data?.best;
  const routeLabel = route ? (route.kind === "single" ? `Uniswap v3 ${(route.fees[0] / 10000).toFixed(2)}%` : `${route.kind === "viaWETH" ? "via WETH" : "via USDG"} ${route.fees.map((f) => (f / 10000).toFixed(2) + "%").join(" / ")}`) : null;
  const idle = market ? Math.max(0, market.supplyUSDG - market.borrowUSDG) : 0;
  const marketDepthOk = market ? plan.debt <= idle : false;
  const enoughBalance = walletUsdg === null || walletUsdg >= dep;

  const modeFor = (mult: number) => (mult === Infinity ? maxLev : Math.min(mult, maxLev));
  const activeMode = MODES.find((m) => Math.abs(modeFor(m.mult) - lev) < 0.005)?.key;

  // one sentence per mode, with this deposit and this stock
  const modeMath = (mult: number) => {
    const l = modeFor(mult);
    const p = planLeverage(dep, l, lltv, oraclePrice, oraclePrice);
    const drop = oraclePrice > 0 && p.liqPrice > 0 ? 1 - p.liqPrice / oraclePrice : 1;
    return { l, control: dep * l, up10: dep * l * 0.1, drop };
  };

  const scenarios = [-0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2].map((m) => {
    const p = oraclePrice * (1 + m);
    const value = plan.tokens * p;
    const liquidated = plan.debt > 0 && value * lltv < plan.debt;
    const equity = Math.max(0, value - plan.debt);
    return { m, p, equity, pnl: equity - dep, liquidated };
  });

  // On-chain execution
  const [slippageBps, setSlippage] = useState(50);
  const allowance = useUsdgAllowance();
  const authorized = useRouterAuthorized();
  const positions = usePositions();
  const { writeContractAsync } = useWriteContract();
  const depositRaw = BigInt(Math.round(dep * 1e6));
  const flashRaw = BigInt(Math.round(plan.flash * 1e6));
  const txSteps: FlowStep[] = [
    {
      key: "approve", label: "Approve USDG", detail: `${fmtNum(dep, 2)} USDG`,
      needed: (allowance.data ?? 0n) < depositRaw,
      run: () => writeContractAsync({ address: ADDR.USDG as Address, abi: erc20Abi, functionName: "approve", args: [ROUTER_ADDRESS!, depositRaw] }),
    },
    {
      key: "auth", label: "Let ATOMIC manage your Morpho position", detail: "one time",
      needed: authorized.data !== true,
      run: () => writeContractAsync({ address: ADDR.MORPHO as Address, abi: morphoAbi, functionName: "setAuthorization", args: [ROUTER_ADDRESS!, true] }),
    },
    {
      key: "open", label: `Buy ${symbol} with ${lev.toFixed(2)}x`, detail: "one transaction",
      needed: true,
      run: () =>
        writeContractAsync({
          address: ROUTER_ADDRESS!, abi: ROUTER_ABI, functionName: "openLeverage",
          args: [marketParams(market!), depositRaw, flashRaw, routeToPath(ADDR.USDG as Address, stock!.address as Address, route!), withSlippage(BigInt(route!.amountOut), slippageBps)],
        }),
    },
  ];

  const techSteps = [
    { label: "Flash borrow", detail: `${fmtNum(plan.flash, 2)} USDG`, venue: "Morpho" },
    { label: "Swap", detail: `${fmtNum(exposure, 2)} USDG to ${fmtNum(plan.tokens, 4)} ${symbol}`, venue: routeLabel ?? "Uniswap v3" },
    { label: "Supply collateral", detail: `${fmtNum(plan.tokens, 4)} ${symbol}`, venue: "Morpho" },
    { label: "Borrow", detail: `${fmtNum(plan.debt, 2)} USDG at ${fmtPct(plan.ltv, 1)} LTV`, venue: "Morpho" },
    { label: "Repay flash loan", detail: `${fmtNum(plan.flash, 2)} USDG, zero fee`, venue: "Morpho" },
  ];

  const stockName = STOCKS.find((s) => s.symbol === symbol)?.name ?? symbol;
  const ready = dep > 0 && !!route && marketDepthOk && !!market && !!stock && enoughBalance;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      {/* Step 1: stock */}
      <section className="card p-6">
        <StepTitle n={1}>Which stock?</StepTitle>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(symbols.length ? symbols : ["NVDA"]).map((s) => {
            const on = s === symbol;
            return (
              <button key={s} onClick={() => setSymbol(s)} className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all ${on ? "border-flash bg-flash/10 shadow-[0_0_0_1px_rgba(var(--flash-rgb),0.5)]" : "border-line hover:border-line-2"}`}>
                <Ticker symbol={s} size="lg" />
                <span className={`font-mono text-xs ${on ? "text-text" : "text-muted"}`}>{s}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted">
          {stockName} is {feed ? fmtUsd(feed) : "loading"} right now. These are the stocks with a live lending market on Robinhood Chain.
        </p>
      </section>

      {/* Step 2: amount */}
      <section className="card p-6">
        <StepTitle n={2}>How much of your money?</StepTitle>
        <div className="mt-5 flex items-center rounded-2xl border border-line bg-bg/40 px-5 py-4 focus-within:border-flash">
          <span className="mr-2 font-mono text-2xl text-muted-2">$</span>
          <input
            inputMode="decimal"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value.replace(/[^0-9.]/g, ""))}
            className="w-full bg-transparent font-mono text-3xl tabular outline-none"
            placeholder="0"
          />
          <span className="ml-3 font-mono text-sm text-muted">USDG</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[100, 500, 1000, 5000].map((v) => (
            <button key={v} onClick={() => setDeposit(String(v))} className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${dep === v ? "border-flash text-flash" : "border-line text-muted hover:border-line-2"}`}>{v.toLocaleString("en-US")}</button>
          ))}
          {walletUsdg !== null ? (
            <button onClick={() => setDeposit(Math.floor(walletUsdg * 100) / 100 + "")} className="ml-auto font-mono text-[11px] text-flash hover:underline">wallet has {fmtUsd(walletUsdg)}, use all</button>
          ) : (
            <span className="ml-auto font-mono text-[11px] text-muted-2">USDG is the dollar on Robinhood Chain</span>
          )}
        </div>
      </section>

      {/* Step 3: boost */}
      <section className="card p-6">
        <StepTitle n={3}>How bold?</StepTitle>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const x = modeMath(m.mult);
            const on = activeMode === m.key;
            return (
              <button key={m.key} onClick={() => setLeverage(x.l)} className={`rounded-2xl border p-4 text-left transition-all ${on ? "border-flash bg-flash/10 shadow-[0_0_0_1px_rgba(var(--flash-rgb),0.5)]" : "border-line hover:border-line-2"}`}>
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-semibold ${on ? "text-text" : "text-muted"}`}>{m.label}</span>
                  <span className={`font-mono text-xl tabular ${on ? "text-flash" : "text-text"}`}>{x.l.toFixed(1)}x</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-2">{m.blurb}</div>
                <div className="mt-3 text-xs leading-relaxed text-muted">
                  You control <b className="text-text">{fmtUsd(x.control, 0)}</b> of {symbol}. If it rises 10% you make <b className="text-up">{fmtUsd(x.up10, 0)}</b>.
                  {x.l > 1.001 ? <> It closes if {symbol} falls <b className="text-down">{fmtPct(x.drop, 0)}</b>.</> : <> Nothing borrowed, so it never closes on you.</>}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-2">A 10% rise makes the same as a 10% fall loses. The higher the leverage, the sooner a fall closes the position.</p>
      </section>

      {/* Summary + button */}
      <section className="card p-6">
        <div className="flex items-start gap-4">
          <Ticker symbol={symbol} size="xl" />
          <div>
            <div className="text-lg font-semibold leading-snug md:text-xl">Buy {fmtUsd(exposure, 0)} of {symbol} with {fmtUsd(dep, 0)} of your money.</div>
            <p className="mt-1.5 text-sm text-muted">
              ATOMIC borrows the other <b className="text-text">{fmtUsd(plan.debt, 0)}</b> for you inside the same transaction. It costs about <b className="text-text">{fmtUsd(yearlyCost)}</b> a year in interest{holder.isHolder ? <> and <b className="text-up">no ATOMIC fee</b>, because you hold ATOMIC</> : <> and a one-time <b className="text-text">{fmtUsd(oneTimeFee)}</b> fee</>}.
              {plan.liqPrice > 0 && <> If {symbol} falls to <b className="text-down">{fmtUsd(plan.liqPrice)}</b> ({fmtPct(dropToLiq, 0)} down) the position is closed for you and the loan is repaid from it.</>}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <ExecuteFlow
            steps={txSteps}
            label={`Buy ${symbol} with ${lev.toFixed(1)}x leverage`}
            ready={ready}
            blocker={!enoughBalance ? `Your wallet has ${fmtUsd(walletUsdg ?? 0)} USDG` : dep > 0 && !marketDepthOk ? "Not enough USDG left to borrow in this market" : dep > 0 && !route && !quote.isFetching ? "No route for this size" : undefined}
            onDone={() => {
              if (address && market) saveEntry(address, { marketId: market.id, symbol, price: execPrice, deposit: dep, tokens: plan.tokens, debt: plan.debt, at: Date.now() });
              positions.refetch();
            }}
          />
        </div>
        {!isConnected && <p className="mt-3 text-center text-[11px] text-muted-2">You can play with the numbers without a wallet. Connect one when you want to buy.</p>}
      </section>

      {/* Details, folded */}
      <div className="rounded-2xl border border-line">
        <button onClick={() => setShowDetails((v) => !v)} className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm text-muted">
          <span>{showDetails ? "Hide details" : "Show details: what-if table, chart, fine-tune, how it runs"}</span>
          <span className={`transition-transform ${showDetails ? "rotate-45" : ""}`}>+</span>
        </button>
        <AnimatePresence>
          {showDetails && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid gap-6 border-t border-line p-5">
                <div>
                  <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-muted-2">
                    <span>fine tune the leverage</span>
                    <span>1x means no borrowing, {maxLev.toFixed(2)}x is the most this market allows today</span>
                  </div>
                  <input type="range" min={1} max={maxLev} step={0.01} value={lev} onChange={(e) => setLeverage(parseFloat(e.target.value))} style={{ ["--pct" as string]: `${((lev - 1) / (maxLev - 1)) * 100}%` }} />
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-2">
                    Why {maxLev.toFixed(2)}x: Morpho lets a {symbol} position borrow up to {fmtPct(lltv, 1)} of what the stock is worth. Going all the way would sit right at the liquidation line, so ATOMIC stops at 90% of it.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { l: "You control", v: fmtUsd(exposure), s: `${fmtNum(plan.tokens, 3)} ${symbol} at ${fmtUsd(execPrice)}` },
                    { l: "You owe", v: fmtUsd(plan.debt), s: `about ${fmtUsd(yearlyCost)} a year` },
                    { l: "Closes if price falls to", v: plan.liqPrice ? fmtUsd(plan.liqPrice) : "never", s: plan.liqPrice ? `${fmtPct(dropToLiq, 0)} below today` : "no borrowing" },
                  ].map((c) => (
                    <div key={c.l} className="rounded-2xl border border-line bg-bg/40 p-4">
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">{c.l}</div>
                      <div className="mt-1.5 font-mono text-xl tabular">{c.v}</div>
                      <div className="mt-0.5 text-[11px] text-muted">{c.s}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-muted-2"><span>if {symbol} moves</span><span>your {fmtUsd(dep, 0)} becomes</span></div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {scenarios.map((s) => (
                      <div key={s.m} className={`rounded-xl border p-2 text-center ${s.liquidated ? "border-down/40 bg-down/10" : s.m === 0 ? "border-line-2 bg-text/5" : "border-line bg-bg/40"}`}>
                        <div className={`font-mono text-[11px] ${s.m > 0 ? "text-up" : s.m < 0 ? "text-down" : "text-muted"}`}>{s.m > 0 ? "+" : ""}{Math.round(s.m * 100)}%</div>
                        <div className="mt-1 font-mono text-sm tabular">{s.liquidated ? "closed" : fmtUsd(s.equity, 0)}</div>
                        <div className={`mt-0.5 font-mono text-[10px] ${s.liquidated ? "text-down" : s.pnl > 0 ? "text-up" : s.pnl < 0 ? "text-down" : "text-muted-2"}`}>{s.liquidated ? "liquidated" : `${s.pnl >= 0 ? "+" : ""}${fmtUsd(s.pnl, 0)}`}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-muted-2"><span>your money across prices</span><span>shaded zone is liquidation</span></div>
                  <PositionChart tokens={plan.tokens} debt={plan.debt} price={oraclePrice} liqPrice={plan.liqPrice} deposit={dep} symbol={symbol} />
                </div>

                <div className="divide-y divide-line rounded-xl border border-line bg-bg/40 px-3">
                  <div className="flex justify-between py-2 text-xs"><span className="text-muted">One-time ATOMIC fee</span><span className={`font-mono ${holder.isHolder ? "text-up" : ""}`}>{holder.isHolder ? "waived, holder" : fmtUsd(oneTimeFee)}</span></div>
                  <div className="flex justify-between py-2 text-xs"><span className="text-muted">Interest at today&apos;s rate</span><span className="font-mono">{fmtUsd(yearlyCost)} / year</span></div>
                  <div className="flex justify-between py-2 text-xs"><span className="text-muted">Buy price vs market</span><span className={`font-mono ${Math.abs(impact) > 0.01 ? "text-warn" : ""}`}>{impact >= 0 ? "+" : ""}{fmtPct(impact)}</span></div>
                  <div className="flex items-center justify-between py-2 text-xs">
                    <span className="text-muted">Max slippage</span>
                    <label className="flex items-center gap-1 font-mono"><input type="number" step="0.1" min="0.1" max="5" value={slippageBps / 100} onChange={(e) => setSlippage(Math.round(parseFloat(e.target.value || "0.5") * 100))} className="w-12 rounded-md border border-line bg-bg/60 px-1.5 py-0.5 text-right outline-none" />%</label>
                  </div>
                </div>

                <div>
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">How it runs, in one transaction</div>
                  <StepList steps={techSteps} />
                  <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[11px]">
                    <div className="rounded-xl border border-line bg-bg/40 p-3"><div className="text-muted-2">route</div><div className="mt-1 text-text">{routeLabel ?? "-"}</div></div>
                    <div className="rounded-xl border border-line bg-bg/40 p-3"><div className="text-muted-2">market idle USDG</div><div className="mt-1 text-text">{fmtUsd(idle)}</div></div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-2">Quote from Uniswap QuoterV2, collateral value from the Morpho oracle, rate from the AdaptiveCurve IRM. Numbers move every block.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
