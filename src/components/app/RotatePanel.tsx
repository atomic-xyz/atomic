"use client";

import { useMemo, useState } from "react";
import type { Address } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { Ticker } from "@/components/ui/primitives";
import { useQuote, useSnapshot } from "@/hooks/useSnapshot";
import { useHolderStatus, usePositions, useRouterAuthorized } from "@/hooks/useOnchain";
import { ADDR } from "@/lib/addresses";
import { stockBySymbol } from "@/lib/data";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/math";
import { marketParams, morphoAbi, ROUTER_ABI, ROUTER_ADDRESS, routeToPath, withSlippage } from "@/lib/router";
import { AmountInput, Panel, StepList, StockSelect } from "./shared";
import { ExecuteFlow, type FlowStep } from "./ExecuteFlow";

export function RotatePanel() {
  const { data } = useSnapshot();
  const { isConnected } = useAccount();
  const markets = useMemo(() => data?.markets ?? [], [data]);
  const symbols = useMemo(() => markets.map((m) => m.symbol), [markets]);
  const positions = usePositions();
  const held = positions.positions.map((p) => p.market.symbol);

  const [pickedFrom, setFrom] = useState("NVDA");
  const [pickedTo, setTo] = useState("AAPL");
  const [collateral, setCollateral] = useState("10");
  const [debt, setDebt] = useState("1000");
  const [showTech, setShowTech] = useState(false);

  // When the wallet holds positions, the "from" list is those positions; otherwise the simulator uses any market.
  const fromOptions = held.length ? held : symbols;
  const from = fromOptions.length && !fromOptions.includes(pickedFrom) ? fromOptions[0] : pickedFrom;
  const toOptions = symbols.filter((s) => s !== from);
  const to = toOptions.length && !toOptions.includes(pickedTo) ? toOptions[0] : pickedTo;

  const mFrom = markets.find((m) => m.symbol === from);
  const mTo = markets.find((m) => m.symbol === to);
  const sFrom = stockBySymbol(from);
  const sTo = stockBySymbol(to);
  const pos = positions.positions.find((x) => x.market.symbol === from);
  const onchain = isConnected && !!pos;
  const coll = onchain ? Number(pos.collateral) / 1e18 : Math.max(0, parseFloat(collateral) || 0);
  const debtUsd = onchain ? Number(pos.debt) / 1e6 : Math.max(0, parseFloat(debt) || 0);

  const amountIn = useMemo(() => (onchain ? pos.collateral : BigInt(Math.round(coll * 1e6)) * 10n ** 12n), [onchain, pos, coll]);
  const quote = useQuote(sFrom?.address, sTo?.address, amountIn);
  const out = quote.data?.best ? Number(BigInt(quote.data.best.amountOut)) / 1e18 : 0;
  const route = quote.data?.best;
  const routeLabel = route ? (route.kind === "single" ? `direct ${(route.fees[0] / 10000).toFixed(2)}%` : `${route.kind === "viaWETH" ? "via WETH" : "via USDG"} ${route.fees.map((f) => (f / 10000).toFixed(2) + "%").join(" / ")}`) : null;

  const pFrom = mFrom?.oraclePrice || data?.feeds[from]?.price || 0;
  const pTo = mTo?.oraclePrice || data?.feeds[to]?.price || 0;
  const valueBefore = coll * pFrom;
  const valueAfter = out * pTo;
  const ltvBefore = valueBefore > 0 ? debtUsd / valueBefore : 0;
  const ltvAfter = valueAfter > 0 ? debtUsd / valueAfter : 0;
  const slip = valueBefore > 0 && out > 0 ? valueAfter / valueBefore - 1 : 0;
  const lltvFrom = mFrom?.lltv ?? 0.625;
  const lltvTo = mTo?.lltv ?? 0.625;
  const liqBefore = coll > 0 && debtUsd > 0 ? debtUsd / (coll * lltvFrom) : 0;
  const liqAfter = out > 0 && debtUsd > 0 ? debtUsd / (out * lltvTo) : 0;
  const dropBefore = pFrom > 0 && liqBefore > 0 ? 1 - liqBefore / pFrom : 1;
  const dropAfter = pTo > 0 && liqAfter > 0 ? 1 - liqAfter / pTo : 1;
  const okAfter = ltvAfter < lltvTo * 0.98;
  const holder = useHolderStatus();
  const fee = holder.isHolder ? 0 : debtUsd * (holder.feeBps / 10_000);
  const idleTo = mTo ? Math.max(0, mTo.supplyUSDG - mTo.borrowUSDG) : 0;
  const depthOk = debtUsd === 0 || idleTo >= debtUsd;
  const risk = dropAfter > 0.35 ? "safe" : dropAfter > 0.15 ? "careful" : "risky";
  const riskLabel = { safe: "Safe", careful: "Careful", risky: "Risky" }[risk];
  const riskTone = { safe: "text-up", careful: "text-warn", risky: "text-down" }[risk];

  const [slippageBps, setSlippage] = useState(50);
  const authorized = useRouterAuthorized();
  const { writeContractAsync } = useWriteContract();
  const txSteps: FlowStep[] = [
    {
      key: "auth", label: "Allow ATOMIC on Morpho", detail: "one time",
      needed: authorized.data !== true,
      run: () => writeContractAsync({ address: ADDR.MORPHO as Address, abi: morphoAbi, functionName: "setAuthorization", args: [ROUTER_ADDRESS!, true] }),
    },
    {
      key: "rotate", label: `Move ${from} into ${to}`, detail: "one transaction",
      needed: true,
      run: () =>
        writeContractAsync({
          address: ROUTER_ADDRESS!, abi: ROUTER_ABI, functionName: "rotate",
          args: [marketParams(mFrom!), marketParams(mTo!), routeToPath(sFrom!.address as Address, sTo!.address as Address, route!), withSlippage(BigInt(route!.amountOut), slippageBps)],
        }),
    },
  ];

  const techSteps = [
    { label: "Flash borrow", detail: `${fmtNum(debtUsd, 2)} USDG`, venue: "Morpho" },
    { label: "Repay and withdraw", detail: `${fmtNum(coll, 4)} ${from} released`, venue: `Morpho ${from}` },
    { label: "Swap", detail: `${fmtNum(coll, 4)} ${from} to ${fmtNum(out, 4)} ${to}`, venue: routeLabel ?? "Uniswap v3" },
    { label: "Supply and borrow", detail: `${fmtNum(out, 4)} ${to}, borrow ${fmtNum(debtUsd + fee, 2)} USDG`, venue: `Morpho ${to}` },
    { label: "Repay flash loan", detail: `${fmtNum(debtUsd, 2)} USDG`, venue: "Morpho" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="grid gap-5">
        <Panel title="Step 1. Which position do you want to move">
          {isConnected && held.length === 0 && !positions.isLoading && (
            <p className="mb-4 rounded-2xl border border-warn/40 bg-warn/5 p-4 text-sm text-muted">This wallet has no position on a stock market yet. Open one in the Perpetual tab first. The numbers below are a simulation.</p>
          )}
          {!isConnected && <p className="mb-4 text-sm text-muted">Connect a wallet to move a real position. Without one you can still try the numbers.</p>}
          <div className="grid items-end gap-4 md:grid-cols-[1fr_auto_1fr]">
            <StockSelect label={onchain ? "Your position in" : "From"} value={from} onChange={(s) => { setFrom(s); if (s === to) setTo(symbols.find((x) => x !== s) ?? to); }} options={fromOptions.length ? fromOptions : ["NVDA"]} />
            <button onClick={() => { if (!onchain) { setFrom(to); setTo(from); } }} disabled={onchain} className="mx-auto mb-1.5 grid h-10 w-10 place-items-center rounded-full border border-line text-muted transition-colors hover:border-flash hover:text-flash disabled:opacity-30" aria-label="Swap direction">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
            <StockSelect label="Move it into" value={to} onChange={setTo} options={toOptions.length ? toOptions : ["AAPL"]} />
          </div>
          {!onchain && (
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <AmountInput label={`${from} you hold`} unit={from} value={collateral} onChange={setCollateral} hint={<span className="text-muted-2">{pFrom ? fmtUsd(coll * pFrom) : ""}</span>} />
              <AmountInput label="Loan you owe" unit="USDG" value={debt} onChange={setDebt} hint={<span className="text-muted-2">unchanged</span>} />
            </div>
          )}
        </Panel>

        <Panel title="What happens" right={<span className={`inline-flex items-center gap-2 font-mono text-[11px] ${riskTone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{riskLabel} after the move</span>}>
          <div className="flex items-center gap-3">
            <Ticker symbol={from} size="xl" />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-flash"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            <Ticker symbol={to} size="xl" />
            <p className="ml-2 text-[15px] leading-relaxed text-text">
              Your <b>{fmtNum(coll, 3)} {from}</b> (worth <b>{fmtUsd(valueBefore)}</b>) becomes <b>{fmtNum(out, 3)} {to}</b> (worth <b>{fmtUsd(valueAfter)}</b>). Your loan of <b>{fmtUsd(debtUsd)}</b> stays exactly the same. Nothing is sold to cash in between, and it all happens in one transaction.
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { l: "Cost of the move", v: `${slip >= 0 ? "+" : ""}${fmtPct(slip)}`, s: "swap fees and price impact" },
              { l: `Forced close, ${from} today`, v: liqBefore ? fmtUsd(liqBefore) : "never", s: liqBefore ? `${fmtPct(dropBefore, 0)} below price` : "no loan" },
              { l: `Forced close, ${to} after`, v: liqAfter ? fmtUsd(liqAfter) : "never", s: liqAfter ? `${fmtPct(dropAfter, 0)} below price` : "no loan" },
            ].map((c) => (
              <div key={c.l} className="rounded-2xl border border-line bg-bg/40 p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">{c.l}</div>
                <div className="mt-1.5 font-mono text-xl tabular">{c.v}</div>
                <div className="mt-0.5 text-[11px] text-muted">{c.s}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            The distance to a forced close changes because {to} is a different price and the loan is now measured against {to}. Interest on the loan goes from {fmtPct(mFrom?.borrowApy ?? 0)} to {fmtPct(mTo?.borrowApy ?? 0)} a year.
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 self-start lg:sticky lg:top-6">
        <Panel title="Step 2. Confirm">
          <div className="grid gap-2 text-sm">
            {[
              { t: "Allow ATOMIC on Morpho", d: "one-time permission, skipped if already given" },
              { t: `Move ${from} into ${to}`, d: "one transaction; if any step fails, nothing changes" },
            ].map((s, i) => (
              <div key={s.t} className="flex gap-3 rounded-xl border border-line bg-bg/40 px-3 py-2.5">
                <span className="font-mono text-[11px] text-flash">{i + 1}</span>
                <div><div className="text-text">{s.t}</div><div className="text-xs text-muted">{s.d}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-bg/40 px-3">
            <div className="flex justify-between py-2 text-xs"><span className="text-muted">One-time ATOMIC fee</span><span className={`font-mono ${holder.isHolder ? "text-up" : ""}`}>{holder.isHolder ? "waived, holder" : fmtUsd(fee)}</span></div>
            <div className="flex justify-between py-2 text-xs"><span className="text-muted">You receive at least</span><span className="font-mono">{route ? `${fmtNum(Number(withSlippage(BigInt(route.amountOut), slippageBps)) / 1e18, 4)} ${to}` : "-"}</span></div>
          </div>
          <div className="mt-4">
            <ExecuteFlow
              steps={txSteps}
              label={`Move ${from} into ${to}`}
              ready={onchain && coll > 0 && !!route && okAfter && depthOk && !!mFrom && !!mTo}
              blocker={isConnected && !pos ? `No ${from} position in this wallet` : !okAfter && out > 0 ? `Too close to a forced close on ${to}` : !depthOk ? `Not enough USDG to borrow in the ${to} market` : undefined}
              onDone={() => positions.refetch()}
            />
          </div>
        </Panel>

        <div className="rounded-2xl border border-line bg-surface/40">
          <button onClick={() => setShowTech((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            Under the hood <span className={`transition-transform ${showTech ? "rotate-45" : ""}`}>+</span>
          </button>
          {showTech && (
            <div className="border-t border-line p-4">
              <StepList steps={techSteps} />
              <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="rounded-xl border border-line bg-bg/40 p-3"><div className="text-muted-2">route</div><div className="mt-1 text-text">{routeLabel ?? "-"}</div></div>
                <div className="rounded-xl border border-line bg-bg/40 p-3"><div className="text-muted-2">LTV before / after</div><div className="mt-1 text-text">{fmtPct(ltvBefore, 1)} / {fmtPct(ltvAfter, 1)}</div></div>
                <div className="rounded-xl border border-line bg-bg/40 p-3"><div className="text-muted-2">idle USDG in {to}</div><div className="mt-1 text-text">{fmtUsd(idleTo)}</div></div>
                <div className="rounded-xl border border-line bg-bg/40 p-3">
                  <div className="text-muted-2">slippage</div>
                  <label className="mt-1 flex items-center gap-1 text-text"><input type="number" step="0.1" min="0.1" max="5" value={slippageBps / 100} onChange={(e) => setSlippage(Math.round(parseFloat(e.target.value || "0.5") * 100))} className="w-12 rounded-md border border-line bg-bg/60 px-1.5 py-0.5 text-right outline-none" />%</label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
