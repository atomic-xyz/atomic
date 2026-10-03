"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { Ticker } from "@/components/ui/primitives";
import { useSnapshot } from "@/hooks/useSnapshot";
import { useBorrowers, type Borrower } from "@/hooks/useBorrowers";
import { useHolderStatus } from "@/hooks/useOnchain";
import { buildOpps, type Opp } from "@/lib/arb";
import { dexLabel } from "@/lib/data";
import { EXPLORER } from "@/lib/addresses";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/math";
import { Panel } from "./shared";
import { WalletButton } from "./WalletButton";

const PONS_URL = "https://ponsfamily.com";
const ALERTS_KEY = "atomic-holder-alerts";
const WATCH_DROP = 0.15; // positions closer than this to liquidation make the watch list
const ALERT_DROP = 0.05; // and this close triggers a notification
const FREE_ROWS = 2; // rows everyone sees before the lock

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// The alerts switch lives in localStorage and is read through useSyncExternalStore, so it never
// touches state inside an effect and renders "off" on the server.
const ALERTS_EVENT = "atomic-holder-alerts-change";
function subscribeAlerts(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(ALERTS_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(ALERTS_EVENT, cb);
  };
}
function readAlerts(): boolean {
  try {
    return window.localStorage.getItem(ALERTS_KEY) === "1" && typeof Notification !== "undefined" && Notification.permission === "granted";
  } catch {
    return false;
  }
}
function writeAlerts(on: boolean) {
  try {
    window.localStorage.setItem(ALERTS_KEY, on ? "1" : "0");
  } catch {
    /* storage blocked: the switch simply does not persist */
  }
  window.dispatchEvent(new Event(ALERTS_EVENT));
}

export function HoldersPanel() {
  const holder = useHolderStatus();
  const { isConnected } = useAccount();
  const { data: snap } = useSnapshot();
  const { data: board } = useBorrowers();

  const opps = useMemo(() => buildOpps(snap).filter((o) => o.venues.length > 1 && o.gross > 0.0005), [snap]);
  const watch = useMemo(
    () => (board?.borrowers ?? []).filter((b) => b.dropToLiquidation !== null && b.dropToLiquidation < WATCH_DROP && b.borrowUsd >= 5).sort((a, b) => (a.dropToLiquidation ?? 1) - (b.dropToLiquidation ?? 1)),
    [board],
  );

  const unlocked = holder.isHolder;
  const [alerts, setAlerts] = useAlerts(unlocked, opps, watch);

  const needed = holder.min > 0n ? fmtNum(Number(holder.min) / 1e18, 0) : null;
  const have = fmtNum(Number(holder.balance) / 1e18, 2);

  return (
    <div className="grid gap-5">
      {/* status */}
      <Panel>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">Your status</div>
            {!holder.enabled ? (
              <>
                <div className="mt-2 text-xl font-semibold">The ATOMIC token is not live yet</div>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                  When it launches, the router will recognise wallets that hold it. Those wallets pay <b className="text-text">no router fee</b> on any action
                  and unlock everything on this page. Until then you can see a preview of the signals below.
                </p>
              </>
            ) : !isConnected ? (
              <>
                <div className="mt-2 text-xl font-semibold">Connect to check your wallet</div>
                <p className="mt-2 text-sm text-muted">Holding {needed ? `${needed} ATOMIC` : "ATOMIC"} removes the router fee and unlocks the signals.</p>
                <div className="mt-4"><WalletButton /></div>
              </>
            ) : unlocked ? (
              <>
                <div className="mt-2 flex items-center gap-2 text-xl font-semibold">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-up" /> Holder, everything unlocked
                </div>
                <p className="mt-2 text-sm text-muted">You hold {have} ATOMIC. Your router fee is zero and the signals below are live for you.</p>
              </>
            ) : (
              <>
                <div className="mt-2 text-xl font-semibold">Not a holder yet</div>
                <p className="mt-2 text-sm text-muted">
                  This wallet holds <b className="text-text">{have} ATOMIC</b>{needed ? <>, the perks start at <b className="text-text">{needed} ATOMIC</b></> : null}.
                </p>
                <a href={PONS_URL} target="_blank" rel="noreferrer" className="btn-flash mt-4 inline-flex rounded-full px-5 py-2.5 text-sm">Get ATOMIC</a>
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <Perk on={unlocked} title="Zero router fee" body={unlocked ? "Every perpetual, rotate and arbitrage runs without the 0.05% fee." : "Holders skip the 0.05% fee on every action."} />
            <Perk on={unlocked} title="Signals first" body="Every price gap between pools, including the ones below the public threshold, the moment they appear." />
            <Perk on={unlocked} title="Liquidation watch" body="Positions on the Borrowers board that are close to being closed by force, with browser alerts." />
          </div>
        </div>
        {holder.token && (
          <div className="mt-4 font-mono text-[11px] text-muted-2">
            token <a href={`${EXPLORER}/address/${holder.token}`} target="_blank" rel="noreferrer" className="hover:underline">{holder.token}</a>
          </div>
        )}
      </Panel>

      {/* alerts */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-5 py-3">
        <div className="text-sm text-muted">
          <b className="text-text">Browser alerts.</b> A notification when a new gap becomes profitable, or when a position gets within {fmtPct(ALERT_DROP, 0)} of liquidation.
        </div>
        <button
          onClick={() => setAlerts(!alerts)}
          disabled={!unlocked}
          className={`rounded-full border px-4 py-1.5 font-mono text-[11px] ${alerts ? "border-up/40 bg-up/10 text-up" : "border-line text-muted hover:border-line-2"} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {alerts ? "alerts on" : unlocked ? "turn alerts on" : "holders only"}
        </button>
      </div>

      {/* signals */}
      <Panel title="Price gaps between pools, all of them" right={<span className="font-mono text-[11px] text-muted-2">{opps.length} stocks, refreshed every 10s</span>}>
        <Locked unlocked={unlocked} rows={opps.length} enabled={holder.enabled}>
          <div className="divide-y divide-line">
            {opps.map((o, i) => <SignalRow key={o.symbol} o={o} dim={!unlocked && i >= FREE_ROWS} />)}
            {opps.length === 0 && <p className="py-6 text-center text-sm text-muted">No gaps above 0.05% right now.</p>}
          </div>
        </Locked>
      </Panel>

      {/* liquidation watch */}
      <Panel title="Liquidation watch" right={<span className="font-mono text-[11px] text-muted-2">positions within {fmtPct(WATCH_DROP, 0)} of being closed</span>}>
        <Locked unlocked={unlocked} rows={watch.length} enabled={holder.enabled}>
          <div className="divide-y divide-line">
            {watch.map((b, i) => <WatchRow key={`${b.address}-${b.symbol}`} b={b} price={snap?.feeds[b.symbol]?.price ?? 0} dim={!unlocked && i >= FREE_ROWS} />)}
            {watch.length === 0 && <p className="py-6 text-center text-sm text-muted">Nobody is close to liquidation right now.</p>}
          </div>
        </Locked>
      </Panel>
    </div>
  );
}

function Perk({ on, title, body }: { on: boolean; title: string; body: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${on ? "border-up/30 bg-up/5" : "border-line bg-bg/40"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-up" : "bg-muted-2"}`} />
        {title}
      </div>
      <div className="mt-1 text-xs leading-relaxed text-muted">{body}</div>
    </div>
  );
}

/** Shows the first rows to everyone and veils the rest for non-holders. */
function Locked({ unlocked, rows, enabled, children }: { unlocked: boolean; rows: number; enabled: boolean; children: ReactNode }) {
  if (unlocked || rows <= FREE_ROWS) return <>{children}</>;
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[55%] items-end justify-center bg-gradient-to-t from-surface via-surface/85 to-transparent pb-4">
        <div className="pointer-events-auto rounded-full border border-line bg-bg/80 px-4 py-2 font-mono text-[11px] text-muted backdrop-blur">
          {enabled ? `${rows - FREE_ROWS} more for holders` : `${rows - FREE_ROWS} more once the token is live`}
        </div>
      </div>
    </div>
  );
}

function SignalRow({ o, dim }: { o: Opp; dim: boolean }) {
  const hot = o.net > 0 && o.executable;
  return (
    <div className={`grid grid-cols-[1.3fr_1fr_1fr_0.9fr_1.6fr] items-center gap-3 py-3 text-sm ${dim ? "select-none blur-[3px]" : ""}`}>
      <span className="inline-flex items-center gap-2"><Ticker symbol={o.symbol} size="sm" /><span className="font-mono text-xs">{o.symbol}</span></span>
      <span className="font-mono tabular text-xs">gap <b className={hot ? "text-up" : "text-text"}>{fmtPct(o.gross)}</b></span>
      <span className="font-mono tabular text-xs text-muted">fees {fmtPct(o.fees)}</span>
      <span className={`font-mono tabular text-xs ${o.net > 0 ? "text-up" : "text-muted-2"}`}>{o.net > 0 ? "+" : ""}{fmtPct(o.net)} net</span>
      <span className="truncate font-mono text-[11px] text-muted-2">{dexLabel(o.buy.dex)} {fmtUsd(o.buy.price)} → {dexLabel(o.sell.dex)} {fmtUsd(o.sell.price)}{hot ? " · tradeable" : ""}</span>
    </div>
  );
}

function WatchRow({ b, price, dim }: { b: Borrower; price: number; dim: boolean }) {
  const drop = b.dropToLiquidation ?? 0;
  const liq = price > 0 ? price * (1 - drop) : 0;
  const tone = drop < ALERT_DROP ? "text-down" : "text-warn";
  return (
    <div className={`grid grid-cols-[1.3fr_1.2fr_1fr_1fr_1.2fr] items-center gap-3 py-3 text-sm ${dim ? "select-none blur-[3px]" : ""}`}>
      <span className="inline-flex items-center gap-2"><Ticker symbol={b.symbol} size="sm" /><a href={`${EXPLORER}/address/${b.address}`} target="_blank" rel="noreferrer" className="font-mono text-xs hover:underline">{short(b.address)}</a></span>
      <span className="font-mono tabular text-xs text-muted">holds {fmtUsd(b.collateralUsd)}, owes {fmtUsd(b.borrowUsd)}</span>
      <span className={`font-mono tabular text-xs ${tone}`}>closes if {fmtPct(drop, 1)} drop</span>
      <span className="font-mono tabular text-xs text-muted">at {liq ? fmtUsd(liq) : "-"}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-text/8"><span className={`block h-full rounded-full ${drop < ALERT_DROP ? "bg-down" : "bg-warn"}`} style={{ width: `${Math.max(4, Math.min(100, (drop / WATCH_DROP) * 100))}%` }} /></span>
    </div>
  );
}

/** Browser notifications for new profitable gaps and positions near liquidation, holders only. */
function useAlerts(unlocked: boolean, opps: Opp[], watch: Borrower[]): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeAlerts, readAlerts, () => false);
  const seenGaps = useRef<Set<string>>(new Set());
  const seenDanger = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const setOn = (next: boolean) => {
    if (!next) {
      writeAlerts(false);
      return;
    }
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => {
      const ok = p === "granted";
      writeAlerts(ok);
      if (ok) new Notification("ATOMIC alerts on", { body: "You will hear about new gaps and positions near liquidation." });
    });
  };

  useEffect(() => {
    if (!unlocked || !on) return;
    const hot = opps.filter((o) => o.net > 0 && o.executable);
    const danger = watch.filter((b) => (b.dropToLiquidation ?? 1) < ALERT_DROP);
    if (!primed.current) {
      // first pass only records what is already there, so opening the page does not fire a burst
      hot.forEach((o) => seenGaps.current.add(o.symbol));
      danger.forEach((b) => seenDanger.current.add(`${b.address}-${b.symbol}`));
      primed.current = true;
      return;
    }
    for (const o of hot) {
      if (seenGaps.current.has(o.symbol)) continue;
      seenGaps.current.add(o.symbol);
      new Notification(`${o.symbol} gap is tradeable`, { body: `${fmtPct(o.net)} net after fees, ${dexLabel(o.buy.dex)} to ${dexLabel(o.sell.dex)}` });
    }
    for (const sym of Array.from(seenGaps.current)) if (!hot.some((o) => o.symbol === sym)) seenGaps.current.delete(sym);
    for (const b of danger) {
      const k = `${b.address}-${b.symbol}`;
      if (seenDanger.current.has(k)) continue;
      seenDanger.current.add(k);
      new Notification(`${b.symbol} position near liquidation`, { body: `${short(b.address)} closes if ${b.symbol} falls ${fmtPct(b.dropToLiquidation ?? 0, 1)}` });
    }
    for (const k of Array.from(seenDanger.current)) if (!danger.some((b) => `${b.address}-${b.symbol}` === k)) seenDanger.current.delete(k);
  }, [unlocked, on, opps, watch]);

  return [on, setOn];
}
