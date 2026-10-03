"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { Ticker } from "@/components/ui/primitives";
import { useQuote, useSnapshot } from "@/hooks/useSnapshot";
import { useHolderStatus, usePositions, useRouterAuthorized, useUsdgBalance, type OnchainPosition } from "@/hooks/useOnchain";
import { ADDR } from "@/lib/addresses";
import { marketParams, morphoAbi, ROUTER_ABI, ROUTER_ADDRESS, routeToPath, withSlippage } from "@/lib/router";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/math";
import { clearEntry, getEntry } from "@/lib/entries";
import { useBorrowers } from "@/hooks/useBorrowers";
import { ExecuteFlow, type FlowStep } from "./ExecuteFlow";
import { Panel, StepList } from "./shared";
import { WalletButton } from "./WalletButton";

export function PositionsPanel() {
  const { address, isConnected } = useAccount();
  const { positions, isLoading, refetch } = usePositions();
  const bal = useUsdgBalance();

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">Wallet</div>
          <div className="mt-2 font-mono text-2xl tabular">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "not connected"}</div>
          <div className="mt-1 font-mono text-[11px] text-muted">Robinhood Chain</div>
        </div>
        <div className="card p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">Cash (USDG)</div>
          <div className="mt-2 font-mono text-2xl tabular">{bal.data !== undefined ? fmtUsd(Number(bal.data) / 1e6) : "-"}</div>
          <div className="mt-1 font-mono text-[11px] text-muted">ready to put into a position</div>
        </div>
        <div className="card p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">Open positions</div>
          <div className="mt-2 font-mono text-2xl tabular">{address ? positions.length : "-"}</div>
          <div className="mt-1 font-mono text-[11px] text-muted">on stock markets</div>
        </div>
      </div>

      {!isConnected && (
        <Panel>
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">Connect your wallet to see what you own and owe. Positions opened through ATOMIC live on Morpho under your own address, so they show up here even if you opened them somewhere else.</p>
            <WalletButton />
          </div>
        </Panel>
      )}
      {isConnected && isLoading && <div className="skeleton h-40 rounded-2xl" />}
      {isConnected && !isLoading && positions.length === 0 && (
        <Panel><p className="text-sm text-muted">Nothing open yet. Go to the Perpetual tab, pick a stock and an amount, and your position will appear here.</p></Panel>
      )}
      {positions.map((p) => <PositionCard key={p.market.id} p={p} address={address} onChanged={() => refetch()} />)}
    </div>
  );
}

function PositionCard({ p, address, onChanged }: { p: OnchainPosition; address?: string; onChanged: () => void }) {
  const { data } = useSnapshot();
  const { data: board } = useBorrowers();
  const onchain = board?.borrowers.find((b) => b.address.toLowerCase() === address?.toLowerCase() && b.symbol === p.market.symbol);
  const entry = getEntry(address, p.market.id);
  const live = data?.markets.find((m) => m.id === p.market.id);
  const price = live?.oraclePrice ?? 0;
  const coll = Number(p.collateral) / 1e18;
  const debt = Number(p.debt) / 1e6;
  const value = coll * price;
  const equity = Math.max(0, value - debt);
  const pnl = onchain?.pnlUsd ?? (entry ? equity - entry.deposit : null);
  const pnlPct = onchain?.pnlPct ?? (entry && entry.deposit > 0 && pnl !== null ? pnl / entry.deposit : null);
  const entryPrice = onchain?.entryPrice ?? entry?.price ?? null;
  const cashIn = onchain?.cashIn ?? entry?.deposit ?? null;
  const since = onchain?.since ? onchain.since * 1000 : entry?.at ?? null;
  const liq = coll > 0 && debt > 0 ? debt / (coll * p.market.lltv) : 0;
  const drop = price > 0 && liq > 0 ? 1 - liq / price : 1;
  const risk = drop > 0.35 ? "safe" : drop > 0.15 ? "careful" : "risky";
  const riskLabel = { safe: "Safe", careful: "Careful", risky: "Risky" }[risk];
  const riskTone = { safe: "text-up", careful: "text-warn", risky: "text-down" }[risk];
  const riskBar = { safe: "bg-up", careful: "bg-warn", risky: "bg-down" }[risk];
  const [slippageBps, setSlippage] = useState(50);
  const [showTech, setShowTech] = useState(false);

  const quote = useQuote(p.market.collateral, ADDR.USDG, p.collateral);
  const route = quote.data?.best;
  const usdgOut = route ? Number(BigInt(route.amountOut)) / 1e6 : 0;
  const holder = useHolderStatus();
  const fee = holder.isHolder ? 0 : debt * (holder.feeBps / 10_000);
  const remainder = usdgOut - debt - fee;

  const authorized = useRouterAuthorized();
  const { writeContractAsync } = useWriteContract();
  const steps: FlowStep[] = [
    {
      key: "auth", label: "Allow ATOMIC on Morpho", detail: "one time",
      needed: authorized.data !== true,
      run: () => writeContractAsync({ address: ADDR.MORPHO as Address, abi: morphoAbi, functionName: "setAuthorization", args: [ROUTER_ADDRESS!, true] }),
    },
    {
      key: "close", label: `Close ${p.market.symbol}`, detail: "one transaction",
      needed: true,
      run: () =>
        writeContractAsync({
          address: ROUTER_ADDRESS!, abi: ROUTER_ABI, functionName: "closePosition",
          args: [marketParams(p.market), routeToPath(p.market.collateral as Address, ADDR.USDG as Address, route!), withSlippage(BigInt(route!.amountOut), slippageBps)],
        }),
    },
  ];

  const techSteps = [
    { label: "Flash borrow", detail: `${fmtNum(debt, 2)} USDG`, venue: "Morpho" },
    { label: "Repay and withdraw", detail: `${fmtNum(coll, 4)} ${p.market.symbol} released`, venue: "Morpho" },
    { label: "Sell", detail: `${fmtNum(coll, 4)} ${p.market.symbol} for ${fmtNum(usdgOut, 2)} USDG`, venue: "Uniswap v3" },
    { label: "Repay flash loan", detail: `${fmtNum(debt, 2)} USDG plus ${fmtNum(fee, 2)} fee`, venue: "Morpho" },
    { label: "You receive", detail: `${fmtNum(Math.max(remainder, 0), 2)} USDG`, venue: "you" },
  ];

  return (
    <Panel title={`${p.market.symbol} position`} right={<span className={`inline-flex items-center gap-2 font-mono text-[11px] ${riskTone}`}><span className={`h-1.5 w-1.5 rounded-full ${riskBar}`} />{riskLabel}</span>}>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex items-start gap-4">
            <Ticker symbol={p.market.symbol} size="xl" />
            <p className="text-[15px] leading-relaxed text-text">
              You own <b>{fmtNum(coll, 3)} {p.market.symbol}</b> worth <b>{fmtUsd(value)}</b> and owe <b>{fmtUsd(debt)}</b>. Your share of it is <b>{fmtUsd(equity)}</b>.
              {debt > 0 ? <> If {p.market.symbol} falls to <b>{fmtUsd(liq)}</b> ({fmtPct(drop, 0)} below today) the position is closed by force.</> : <> There is no loan on it, so it cannot be force-closed.</>}
            </p>
          </div>
          {pnl !== null && (
            <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${pnl >= 0 ? "border-up/40 bg-up/10" : "border-down/40 bg-down/10"}`}>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">Profit since you opened it, live</div>
                <div className={`mt-1 font-mono text-2xl tabular ${pnl >= 0 ? "text-up" : "text-down"}`}>{pnl >= 0 ? "+" : ""}{fmtUsd(pnl)} <span className="text-base">({pnlPct !== null ? `${pnlPct >= 0 ? "+" : ""}${fmtPct(pnlPct, 1)}` : ""})</span></div>
              </div>
              <div className="text-right font-mono text-[11px] text-muted">
                {entryPrice !== null && <div>entered at {fmtUsd(entryPrice)}, now {fmtUsd(price)}</div>}
                {cashIn !== null && <div>you put in {fmtUsd(cashIn)}{since ? ` on ${new Date(since).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</div>}
              </div>
            </div>
          )}
          {pnl === null && (
            <p className="mt-4 text-[11px] text-muted-2">Working out your entry from the position history, a few seconds.</p>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { l: "Your money in it", v: fmtUsd(equity), s: "collateral value minus loan" },
              { l: "Loan", v: fmtUsd(debt), s: live ? `${fmtPct(live.borrowApy)} a year interest` : "" },
              { l: "Forced close if price falls to", v: liq ? fmtUsd(liq) : "never", s: liq ? `${fmtPct(drop, 0)} below ${fmtUsd(price)}` : "no loan" },
            ].map((c) => (
              <div key={c.l} className="rounded-2xl border border-line bg-bg/40 p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">{c.l}</div>
                <div className="mt-1.5 font-mono text-xl tabular">{c.v}</div>
                <div className="mt-0.5 text-[11px] text-muted">{c.s}</div>
              </div>
            ))}
          </div>
          {debt > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-muted"><span>Distance to forced close</span><span className={riskTone}>{fmtPct(drop, 0)} price drop</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-text/8"><div className={`h-full rounded-full ${riskBar}`} style={{ width: `${Math.min(100, Math.max(4, drop * 250))}%` }} /></div>
            </div>
          )}
        </div>

        <div>
          <div className="rounded-2xl border border-line bg-bg/40 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">Close it now and get back</div>
            <div className="mt-1.5 font-mono text-3xl tabular">{route ? fmtUsd(Math.max(remainder, 0)) : "-"}</div>
            <div className="mt-0.5 text-[11px] text-muted">{route ? `sells ${fmtNum(coll, 3)} ${p.market.symbol} for ${fmtUsd(usdgOut)}, pays the ${fmtUsd(debt)} loan and a ${fmtUsd(fee)} fee` : "getting a live price"}</div>
          </div>
          <div className="mt-3">
            <ExecuteFlow steps={steps} label={`Close and receive ${fmtUsd(Math.max(remainder, 0))}`} ready={!!route && remainder > 0} blocker={route && remainder <= 0 ? "Selling would not cover the loan" : undefined} onDone={() => { if (address) clearEntry(address, p.market.id); onChanged(); }} />
          </div>
          <button onClick={() => setShowTech((v) => !v)} className="mt-3 flex w-full items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">
            Under the hood <span className={`transition-transform ${showTech ? "rotate-45" : ""}`}>+</span>
          </button>
          {showTech && (
            <div className="mt-3">
              <StepList steps={techSteps} accent={remainder > 0} />
              <label className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted">
                slippage
                <span className="flex items-center gap-1"><input type="number" step="0.1" min="0.1" max="5" value={slippageBps / 100} onChange={(e) => setSlippage(Math.round(parseFloat(e.target.value || "0.5") * 100))} className="w-14 rounded-lg border border-line bg-bg/60 px-2 py-1 text-right text-text outline-none" />%</span>
              </label>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
