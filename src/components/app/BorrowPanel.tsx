"use client";

import { useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits, type Address } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { Ticker } from "@/components/ui/primitives";
import { useSnapshot } from "@/hooks/useSnapshot";
import { usePositions, useStockHoldings } from "@/hooks/useOnchain";
import { ADDR } from "@/lib/addresses";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/math";
import { marketParams, morphoAbi } from "@/lib/router";
import { ExecuteFlow, type FlowStep } from "./ExecuteFlow";
import { StepTitle } from "./LeveragePanel";

const SAFETY = 0.9; // never borrow above 90% of the liquidation threshold

// How much of the collateral's value to borrow. The last one resolves to 90% of the market's limit.
const MODES = [
  { key: "careful", label: "Careful", ltv: 0.25, blurb: "a small loan, lots of room" },
  { key: "balanced", label: "Balanced", ltv: 0.4, blurb: "a solid loan, healthy buffer" },
  { key: "bold", label: "Bold", ltv: Infinity, blurb: "the most allowed, thin buffer" },
] as const;

/**
 * Borrow USDG against stock tokens the wallet already holds. No swap and no flash loan: the
 * stock goes into Morpho as collateral under the user's own address and USDG comes out.
 * Two transactions after the one-time token approval.
 */
export function BorrowPanel() {
  const { data } = useSnapshot();
  const { address, isConnected } = useAccount();
  const { holdings, refetch: refetchHoldings } = useStockHoldings();
  const { positions, refetch: refetchPositions } = usePositions();
  const { writeContractAsync } = useWriteContract();

  const markets = useMemo(() => data?.markets ?? [], [data]);
  const symbols = useMemo(() => Array.from(new Set(markets.map((m) => m.symbol))), [markets]);
  const [picked, setSymbol] = useState("NVDA");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("balanced");
  const symbol = symbols.length && !symbols.includes(picked) ? symbols[0] : picked;

  const live = useMemo(() => markets.filter((m) => m.symbol === symbol).sort((a, b) => b.supplyUSDG - b.borrowUSDG - (a.supplyUSDG - a.borrowUSDG))[0], [markets, symbol]);
  const holding = holdings.find((h) => h.market.symbol === symbol);
  const existing = positions.find((p) => p.market.symbol === symbol);

  const price = live?.oraclePrice ?? data?.feeds[symbol]?.price ?? 0;
  const lltv = live?.lltv ?? 0.625;
  const walletTokens = holding ? Number(formatUnits(holding.balance, 18)) : 0;
  const tokens = Math.max(0, parseFloat(amount) || 0);
  let tokensRaw = 0n;
  try {
    tokensRaw = amount ? parseUnits(amount, 18) : 0n;
  } catch {
    tokensRaw = 0n;
  }

  // the loan is sized against everything that will sit in the market, old and new
  const oldColl = existing ? Number(formatUnits(existing.collateral, 18)) : 0;
  const oldDebt = existing ? Number(existing.debt) / 1e6 : 0;
  const collValue = (oldColl + tokens) * price;
  const maxLtv = lltv * SAFETY;
  const idle = live ? Math.max(0, live.supplyUSDG - live.borrowUSDG) : 0;

  const loanFor = (ltv: number) => Math.max(0, collValue * Math.min(ltv, maxLtv) - oldDebt);
  const target = MODES.find((m) => m.key === mode)!;
  const borrow = Math.floor(loanFor(target.ltv) * 100) / 100;
  const totalDebt = oldDebt + borrow;
  const drop = collValue > 0 && totalDebt > 0 ? Math.max(0, 1 - totalDebt / (collValue * lltv)) : 1;
  const liqPrice = price * (1 - drop);
  const yearly = totalDebt * (live?.borrowApy ?? 0);
  const borrowRaw = BigInt(Math.round(borrow * 1e6));

  const enoughStock = !holding || tokensRaw <= holding.balance;
  const enoughLiquidity = borrow <= idle;
  const ready = !!live && !!address && tokens > 0 && borrow > 0 && enoughStock && enoughLiquidity;
  const blocker = !isConnected
    ? undefined
    : tokens <= 0
      ? `Enter how much ${symbol} to put up`
      : !enoughStock
        ? `Your wallet has ${fmtNum(walletTokens, 4)} ${symbol}`
        : !enoughLiquidity
          ? "Not enough USDG left to borrow in this market"
          : borrow <= 0
            ? "Nothing to borrow at this size"
            : undefined;

  const steps: FlowStep[] = live && address
    ? [
        {
          key: "approve", label: `Approve ${symbol}`, detail: `${fmtNum(tokens, 4)} ${symbol}`,
          needed: (holding?.allowance ?? 0n) < tokensRaw,
          run: () => writeContractAsync({ address: live.collateral as Address, abi: erc20Abi, functionName: "approve", args: [ADDR.MORPHO as Address, tokensRaw] }),
        },
        {
          key: "supply", label: `Put up ${symbol} as collateral`, detail: "stays in your name on Morpho",
          needed: true,
          run: () => writeContractAsync({ address: ADDR.MORPHO as Address, abi: morphoAbi, functionName: "supplyCollateral", args: [marketParams(live), tokensRaw, address, "0x"] }),
        },
        {
          key: "borrow", label: `Borrow ${fmtUsd(borrow)}`, detail: "USDG to your wallet",
          needed: true,
          run: () => writeContractAsync({ address: ADDR.MORPHO as Address, abi: morphoAbi, functionName: "borrow", args: [marketParams(live), borrowRaw, 0n, address, address] }),
        },
      ]
    : [];

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <p className="text-[13px] leading-relaxed text-muted">
        Already hold a stock token? Put it up as collateral and borrow USDG against it, without selling. The stock stays yours on Morpho; repay the loan
        any time to take it back.
      </p>

      {/* Step 1: stock */}
      <section className="card p-6">
        <StepTitle n={1}>Which stock do you hold?</StepTitle>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(symbols.length ? symbols : ["NVDA"]).map((s) => {
            const on = s === symbol;
            const h = holdings.find((x) => x.market.symbol === s);
            const bal = h ? Number(formatUnits(h.balance, 18)) : 0;
            return (
              <button key={s} onClick={() => { setSymbol(s); setAmount(""); }} className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all ${on ? "border-flash bg-flash/10 shadow-[0_0_0_1px_rgba(var(--flash-rgb),0.5)]" : "border-line hover:border-line-2"}`}>
                <Ticker symbol={s} size="lg" />
                <span className={`font-mono text-xs ${on ? "text-text" : "text-muted"}`}>{s}</span>
                <span className="font-mono text-[10px] text-muted-2">{isConnected ? (bal > 0 ? fmtNum(bal, 3) : "none") : " "}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted">
          {symbol} is {price ? fmtUsd(price) : "loading"} at the lending market&apos;s oracle.
          {isConnected ? <> Your wallet holds <b className="text-text">{fmtNum(walletTokens, 4)} {symbol}</b>{walletTokens > 0 ? <> worth {fmtUsd(walletTokens * price)}</> : null}.</> : <> Connect a wallet to see what you hold.</>}
          {existing && <> You already have {fmtNum(oldColl, 4)} {symbol} in this market{oldDebt > 0 ? <> and owe {fmtUsd(oldDebt)}</> : null}.</>}
        </p>
      </section>

      {/* Step 2: collateral */}
      <section className="card p-6">
        <StepTitle n={2}>How much do you put up?</StepTitle>
        <div className="mt-5 flex items-center rounded-2xl border border-line bg-bg/40 px-5 py-4 focus-within:border-flash">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="w-full bg-transparent font-mono text-3xl tabular outline-none"
            placeholder="0"
          />
          <span className="ml-3 font-mono text-sm text-muted">{symbol}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[0.25, 0.5, 1].map((f) => (
            <button key={f} disabled={walletTokens <= 0} onClick={() => holding && setAmount(formatUnits((holding.balance * BigInt(Math.round(f * 100))) / 100n, 18))} className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted transition-colors hover:border-line-2 disabled:opacity-40">
              {f === 1 ? "all" : `${f * 100}%`}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-muted-2">{tokens > 0 ? `worth ${fmtUsd(tokens * price)}` : "it stays yours, held on Morpho in your name"}</span>
        </div>
      </section>

      {/* Step 3: loan size */}
      <section className="card p-6">
        <StepTitle n={3}>How much do you borrow?</StepTitle>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const loan = loanFor(m.ltv);
            const debt = oldDebt + loan;
            const d = collValue > 0 && debt > 0 ? Math.max(0, 1 - debt / (collValue * lltv)) : 1;
            const on = mode === m.key;
            return (
              <button key={m.key} onClick={() => setMode(m.key)} className={`rounded-2xl border p-4 text-left transition-all ${on ? "border-flash bg-flash/10 shadow-[0_0_0_1px_rgba(var(--flash-rgb),0.5)]" : "border-line hover:border-line-2"}`}>
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-semibold ${on ? "text-text" : "text-muted"}`}>{m.label}</span>
                  <span className={`font-mono text-xl tabular ${on ? "text-flash" : "text-text"}`}>{fmtUsd(loan, 0)}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-2">{m.blurb}</div>
                <div className="mt-3 text-xs leading-relaxed text-muted">
                  {collValue > 0 ? <>Closed by force if {symbol} falls <b className="text-down">{fmtPct(d, 0)}</b>.</> : <>Enter an amount above to see the numbers.</>}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-2">
          This market lends up to {fmtPct(lltv, 1)} of what the stock is worth. ATOMIC stops at 90% of that so the position does not start on the liquidation line.
        </p>
      </section>

      {/* Summary + button */}
      <section className="card p-6">
        <div className="flex items-start gap-4">
          <Ticker symbol={symbol} size="xl" />
          <div>
            <div className="text-lg font-semibold leading-snug md:text-xl">
              {tokens > 0 ? <>Put up {fmtNum(tokens, 4)} {symbol} and borrow {fmtUsd(borrow)}.</> : <>Borrow USDG against your {symbol}.</>}
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {tokens > 0 ? (
                <>
                  The USDG lands in your wallet. You keep the stock&apos;s upside. Interest is about <b className="text-text">{fmtUsd(yearly)}</b> a year at today&apos;s rate ({fmtPct(live?.borrowApy ?? 0)}), with no due date.
                  {totalDebt > 0 && <> If {symbol} falls to <b className="text-down">{fmtUsd(liqPrice)}</b> ({fmtPct(drop, 0)} down) the position is liquidated.</>}
                </>
              ) : (
                <>No sale, no swap. There is no ATOMIC fee on borrowing; you pay Morpho&apos;s interest only.</>
              )}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <ExecuteFlow
            steps={steps}
            label={`Borrow ${fmtUsd(borrow)} against ${symbol}`}
            ready={ready}
            blocker={blocker}
            onDone={() => { setAmount(""); refetchHoldings(); refetchPositions(); }}
          />
        </div>
        <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-bg/40 px-3">
          <div className="flex justify-between py-2 text-xs"><span className="text-muted">ATOMIC fee</span><span className="font-mono text-up">none</span></div>
          <div className="flex justify-between py-2 text-xs"><span className="text-muted">Interest at today&apos;s rate</span><span className="font-mono">{fmtPct(live?.borrowApy ?? 0)} a year</span></div>
          <div className="flex justify-between py-2 text-xs"><span className="text-muted">USDG left to borrow in this market</span><span className={`font-mono ${enoughLiquidity ? "" : "text-warn"}`}>{fmtUsd(idle)}</span></div>
          <div className="flex justify-between py-2 text-xs"><span className="text-muted">To get the stock back</span><span className="font-mono">repay in My positions</span></div>
        </div>
      </section>
    </div>
  );
}
