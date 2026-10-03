"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Address } from "viem";
import { useWriteContract } from "wagmi";
import { Ticker } from "@/components/ui/primitives";
import { useSnapshot } from "@/hooks/useSnapshot";
import { useNow } from "@/hooks/useNow";
import { dexLabel, stockBySymbol } from "@/lib/data";
import { ADDR, EXPLORER } from "@/lib/addresses";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/math";
import type { VenuePrice } from "@/lib/types";
import { Panel, StepList } from "./shared";
import { ExecuteFlow } from "./ExecuteFlow";
import { ROUTER_ABI, ROUTER_ADDRESS, v3Path } from "@/lib/router";

import { buildOpps, type Opp } from "@/lib/arb";

const venueName = (v: VenuePrice) => `${dexLabel(v.dex)}${v.fee ? ` ${(v.fee / 10000).toFixed(2)}%` : ""} (${v.quote} pool)`;

function venuePath(stock: Address, quote: "USDG" | "WETH", fee: number, direction: "buy" | "sell") {
  const usdg = ADDR.USDG as Address;
  const weth = ADDR.WETH as Address;
  if (quote === "USDG") return direction === "buy" ? v3Path([usdg, stock], [fee]) : v3Path([stock, usdg], [fee]);
  return direction === "buy" ? v3Path([usdg, weth, stock], [100, fee]) : v3Path([stock, weth, usdg], [fee, 100]);
}

export function ArbPanel() {
  const { data, dataUpdatedAt } = useSnapshot();
  const now = useNow();
  const [size, setSize] = useState("5000");
  const [showWatching, setShowWatching] = useState(false);

  const opps = useMemo<Opp[]>(() => buildOpps(data), [data]);

  const sz = Math.max(0, parseFloat(size) || 0);
  const pairs = opps.filter((o) => o.venues.length > 1);
  const watching = opps.filter((o) => o.venues.length === 1);
  const ready = pairs.filter((o) => o.net > 0 && o.executable);
  const blocked = pairs.filter((o) => o.net > 0 && !o.executable); // profitable, but one side is not Uniswap v3

  return (
    <div className="grid gap-5">
      <Panel title="How this works">
        <p className="max-w-3xl text-[15px] leading-relaxed text-text">
          The same stock trades in several pools. When one pool is cheaper than another by more than both pool fees, ATOMIC can buy in the cheap one and sell in the dear one in a single transaction. <b>You need no money for it</b>: the USDG is borrowed for one block and paid back inside the same transaction. If the gap closes before your transaction lands, it cancels itself and you only pay gas.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-2xl border border-line bg-bg/40 px-3 py-2 font-mono text-[11px] text-muted">
            borrow
            <input type="number" value={size} onChange={(e) => setSize(e.target.value)} className="w-24 rounded-lg border border-line bg-bg/60 px-2 py-1 text-right text-text outline-none focus:border-flash/50" />
            USDG per attempt
          </label>
          {[1000, 5000, 20000].map((v) => (
            <button key={v} onClick={() => setSize(String(v))} className={`rounded-full border px-3 py-1 font-mono text-[11px] ${sz === v ? "border-flash text-flash" : "border-line text-muted"}`}>{v.toLocaleString("en-US")}</button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-muted-2">{data ? `refreshed ${Math.max(0, Math.round((now - dataUpdatedAt) / 1000))}s ago, block ${data.block.toLocaleString("en-US")}` : "loading"}</span>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { l: "Gaps you can take right now", v: data ? String(ready.length) : "-", s: "after both pool fees" },
          { l: "Stocks with two or more pools", v: data ? String(pairs.length) : "-", s: "compared every 10 seconds" },
          { l: "Pools watched", v: data ? String(data.venues.length) : "-", s: "Uniswap v3, v4 and forks" },
        ].map((c) => (
          <div key={c.l} className="card p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">{c.l}</div>
            <div className="mt-1.5 font-mono text-2xl tabular">{c.v}</div>
            <div className="mt-0.5 font-mono text-[11px] text-muted">{c.s}</div>
          </div>
        ))}
      </div>

      <div>
        {data && (
          <div className={`mb-4 rounded-2xl border px-5 py-4 ${ready.length > 0 ? "border-up/40 bg-up/10" : "border-line bg-surface"}`}>
            {ready.length > 0 ? (
              <div className="text-[15px] text-text">
                <b className="text-up">{ready.length} {ready.length === 1 ? "gap is" : "gaps are"} takeable right now.</b> Look for the card with the <b>Take it</b> button: {ready.map((o) => o.symbol).join(", ")}.
              </div>
            ) : (
              <div className="text-[15px] leading-relaxed text-text">
                <b>Nothing to take right now, so no card shows a Take it button.</b>{" "}
                <span className="text-muted">
                  The button appears on a card the moment its gap is bigger than the pool fees and both pools are Uniswap v3.
                  {blocked.length > 0 && <> {blocked.length === 1 ? "One gap pays" : `${blocked.length} gaps pay`} today ({blocked.map((o) => o.symbol).join(", ")}) but {blocked.length === 1 ? "sits" : "sit"} on a pool the router cannot trade yet.</>}
                  {" "}Gaps come and go within seconds, so check back or keep this tab open.
                </span>
              </div>
            )}
          </div>
        )}
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Stocks priced in more than one pool</div>
        {!data && <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}</div>}
        {data && pairs.length === 0 && <Panel><p className="text-sm text-muted">No stock has two pools right now, so there is nothing to compare.</p></Panel>}
        <div className="grid gap-3 md:grid-cols-2">
          {pairs.map((o) => <PairCard key={o.symbol} o={o} sz={sz} />)}
        </div>
      </div>

      {watching.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface/40">
          <button onClick={() => setShowWatching((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Watching, one pool only ({watching.length})</span>
            <span className={`font-mono text-muted transition-transform ${showWatching ? "rotate-45" : ""}`}>+</span>
          </button>
          <AnimatePresence initial={false}>
            {showWatching && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid gap-2 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {watching.map((o) => (
                    <div key={o.symbol} className="flex items-center gap-3 rounded-xl border border-line bg-bg/40 px-3 py-2">
                      <Ticker symbol={o.symbol} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-sm"><span className="font-medium">{o.symbol}</span><span className="font-mono text-xs">{fmtUsd(o.buy.price)}</span></div>
                        <div className="truncate font-mono text-[10px] text-muted-2">{venueName(o.buy)}{o.feed ? ` · ${o.buy.deviation >= 0 ? "+" : ""}${fmtPct(o.buy.deviation)} vs Chainlink` : " · no reference price yet"}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="px-4 pb-4 font-mono text-[11px] text-muted-2">Nothing to compare until a second pool opens for these. They stay listed so you see them the moment one does.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function PairCard({ o, sz }: { o: Opp; sz: number }) {
  const [open, setOpen] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const stockAddr = stockBySymbol(o.symbol)?.address as Address | undefined;
  const profit = sz * o.net;
  const gapUsd = o.sell.price - o.buy.price;
  const tone = o.net > 0.001 ? "up" : o.net > 0 ? "warn" : "muted";
  const toneText = { up: "text-up", warn: "text-warn", muted: "text-muted" }[tone];
  const sizeRaw = BigInt(Math.round(sz * 1e6));

  const steps = [
    { label: "Borrow", detail: `${fmtNum(sz, 0)} USDG for one block`, venue: "Morpho" },
    { label: "Buy", detail: `${fmtNum(sz / o.buy.price, 4)} ${o.symbol} at ${fmtUsd(o.buy.price)}`, venue: dexLabel(o.buy.dex) },
    { label: "Sell", detail: `at ${fmtUsd(o.sell.price)}`, venue: dexLabel(o.sell.dex) },
    { label: "Pay back", detail: `${fmtNum(sz, 0)} USDG plus 0.05% fee`, venue: "Morpho" },
    { label: "Keep", detail: `${profit >= 0 ? "+" : ""}${fmtUsd(profit)} before price impact`, venue: "you" },
  ];

  return (
    <div className={`card flex flex-col p-5 ${o.net > 0 && o.executable ? "shadow-[0_0_0_1px_rgba(var(--up-rgb),0.35)]" : ""}`}>
      <div className="flex items-center gap-3">
        <Ticker symbol={o.symbol} size="lg" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">{o.symbol}</span>
            <span className={`font-mono text-lg tabular ${toneText}`}>{o.net >= 0 ? "+" : ""}{fmtPct(o.net)}</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] text-muted">
            <span>{stockBySymbol(o.symbol)?.name}</span>
            <span>{o.feed ? `Chainlink ${fmtUsd(o.feed)}` : "no reference price"}</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-text">
        {o.symbol} is <b>{fmtUsd(Math.abs(gapUsd))} cheaper</b> on {venueName(o.buy)} than on {venueName(o.sell)}.
        {o.net > 0
          ? <> Buying there and selling here clears <b className="text-up">{fmtPct(o.net)}</b> after both pool fees, about <b className="text-up">{fmtUsd(profit)}</b> on {fmtUsd(sz, 0)}.</>
          : <> The gap is {fmtPct(o.gross)}, smaller than the {fmtPct(o.fees)} in pool fees, so there is nothing to take yet.</>}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div className="rounded-xl border border-line bg-bg/40 p-2.5"><div className="text-muted-2">buy at</div><div className="mt-0.5 text-text">{fmtUsd(o.buy.price)}</div></div>
        <div className="rounded-xl border border-line bg-bg/40 p-2.5"><div className="text-muted-2">sell at</div><div className="mt-0.5 text-text">{fmtUsd(o.sell.price)}</div></div>
        <div className="rounded-xl border border-line bg-bg/40 p-2.5"><div className="text-muted-2">pool fees</div><div className="mt-0.5 text-text">{fmtPct(o.fees)}</div></div>
      </div>

      {o.executable && o.net > 0 ? (
        <div className="mt-4">
        <ExecuteFlow
          steps={[{
            key: "arb", label: `Take the ${o.symbol} gap`, detail: `${fmtNum(sz, 0)} USDG borrowed`, needed: true,
            run: () => writeContractAsync({
              address: ROUTER_ADDRESS!, abi: ROUTER_ABI, functionName: "arb",
              args: [sizeRaw, venuePath(stockAddr!, o.buy.quote, o.buy.fee!, "buy"), venuePath(stockAddr!, o.sell.quote, o.sell.fee!, "sell"), sizeRaw / 2000n],
            }),
          }]}
          label={`Take it: about ${fmtUsd(profit)}`}
          compact
          ready={o.net > 0 && sz > 0 && o.executable && !!stockAddr}
          
        />
      </div>
      ) : (
        <p className="mt-4 rounded-xl border border-line px-3 py-2.5 text-xs leading-relaxed text-muted">
          {!o.executable
            ? <>Watch only. One side of this gap is on {[o.buy, o.sell].filter((v) => v.dex !== "uniswap-v3-robinhood").map((v) => dexLabel(v.dex)).filter((v, k, a) => a.indexOf(v) === k).join(" and ")}, and the router trades Uniswap v3 pools only for now.</>
            : <>Nothing to take yet. The gap is smaller than the two pool fees combined.</>}
        </p>
      )}

      <button onClick={() => setOpen((v) => !v)} className="mt-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">
        Under the hood <span className={`transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3">
              <StepList steps={steps} accent={o.net > 0} />
              <div className="mt-3 grid gap-1.5">
                {o.venues.map((v) => (
                  <a key={v.pool} href={`${EXPLORER}/address/${v.dex === "uniswap-v4-robinhood" ? ADDR.UNI_V4_POOL_MANAGER : v.pool}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-line px-3 py-1.5 font-mono text-[11px] transition-colors hover:border-line-2">
                    <span>{venueName(v)}</span>
                    <span className="flex gap-3"><span className="text-muted">tvl {fmtUsd(v.tvl)}</span><span>{fmtUsd(v.price)}</span></span>
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-2">Net ignores price impact and gas, so treat it as an upper bound. The router requires at least 0.05% profit or the transaction reverts.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
