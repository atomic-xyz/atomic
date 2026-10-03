"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/ui/primitives";
import { XLink } from "@/components/ui/XLink";
import { useSnapshot } from "@/hooks/useSnapshot";
import { useNow } from "@/hooks/useNow";
import { fmtUsd } from "@/lib/math";
import { ROUTER_ADDRESS } from "@/lib/router";
import { EXPLORER } from "@/lib/addresses";
import { WalletButton } from "./WalletButton";
import { LeveragePanel } from "./LeveragePanel";
import { RotatePanel } from "./RotatePanel";
import { ArbPanel } from "./ArbPanel";
import { PositionsPanel } from "./PositionsPanel";
import { BorrowersPanel } from "./BorrowersPanel";
import { HoldersPanel } from "./HoldersPanel";
import { BorrowPanel } from "./BorrowPanel";

const TABS = [
  { key: "leverage", label: "Perpetual", hint: "A leveraged stock position with no expiry" },
  { key: "borrow", label: "Borrow", hint: "Unlock USDG from stock tokens you already hold" },
  { key: "arb", label: "Arbitrage", hint: "Buy low on one pool, sell high on another, no capital" },
  { key: "borrowers", label: "Borrowers", hint: "Everyone with a loan against a stock token right now" },
  { key: "holders", label: "Holders", hint: "Perks for wallets that hold the ATOMIC token" },
  { key: "positions", label: "My positions", hint: "What you own, what you owe, and your profit since entry" },
  { key: "rotate", label: "Rotate", hint: "Move your position to another stock without selling to cash" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function AppShell() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "leverage") as TabKey;
  const { data, dataUpdatedAt, isError } = useSnapshot();
  const now = useNow();

  const setTab = (k: TabKey) => router.replace(`/app?tab=${k}`, { scroll: false });

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-70" />
      <header className="relative z-20 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="ATOMIC home"><Logo /></Link>
            <nav className="hidden items-center gap-1 rounded-full border border-line bg-surface/60 p-1 md:flex">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} className={`relative rounded-full px-4 py-1.5 text-sm transition-colors ${tab === t.key ? "text-[var(--on-flash)]" : "text-muted hover:text-text"}`}>
                  {tab === t.key && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-flash" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 font-mono text-[11px] text-muted lg:flex">
              {data ? (
                <>
                  <span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${isError ? "bg-down" : "bg-up blink"}`} /> block {data.block.toLocaleString("en-US")}</span>
                  <span className="text-muted-2">ETH {fmtUsd(data.ethUsd, 0)}</span>
                  <span className="text-muted-2">{Math.max(0, Math.round((now - dataUpdatedAt) / 1000))}s ago</span>
                </>
              ) : (
                <span className="skeleton h-3 w-36" />
              )}
            </div>
            <XLink className="hidden h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/60 text-muted transition-colors hover:border-line-2 hover:text-text sm:inline-flex" />
            <WalletButton />
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-full border px-4 py-1.5 text-sm ${tab === t.key ? "border-flash bg-flash text-[var(--on-flash)]" : "border-line text-muted"}`}>{t.label}</button>
          ))}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-2">{TABS.find((t) => t.key === tab)?.hint}</div>
            <h1 className="mt-2 text-2xl tracking-tight md:text-3xl">
              {tab === "leverage" && <>Perpetual leverage on stocks, <span className="font-display italic text-flash">one transaction</span></>}
              {tab === "rotate" && <>Rotate into another stock, <span className="font-display italic text-flash">loan stays put</span></>}
              {tab === "arb" && <>Arbitrage between pools, <span className="font-display italic text-flash">live</span></>}
              {tab === "positions" && <>What you own <span className="font-display italic text-flash">and how it is doing</span></>}
              {tab === "borrowers" && <>Who is borrowing <span className="font-display italic text-flash">against stocks, live</span></>}
              {tab === "borrow" && <>Borrow against your stocks, <span className="font-display italic text-flash">without selling them</span></>}
              {tab === "holders" && <>Hold ATOMIC, <span className="font-display italic text-flash">trade with no fee and see signals first</span></>}
            </h1>
          </div>
          {ROUTER_ADDRESS ? (
            <a href={`${EXPLORER}/address/${ROUTER_ADDRESS}`} target="_blank" rel="noreferrer" className="rounded-full border border-up/40 bg-up/10 px-3 py-1.5 font-mono text-[11px] text-up hover:underline">
              Router live at {ROUTER_ADDRESS.slice(0, 6)}…{ROUTER_ADDRESS.slice(-4)}
            </a>
          ) : (
            <div className="rounded-full border border-warn/40 bg-warn/10 px-3 py-1.5 font-mono text-[11px] text-warn">
              Simulation mode: quotes and rates are live, execution opens when the router is verified
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            {tab === "leverage" && <LeveragePanel />}
            {tab === "rotate" && <RotatePanel />}
            {tab === "arb" && <ArbPanel />}
            {tab === "positions" && <PositionsPanel />}
            {tab === "borrowers" && <BorrowersPanel />}
            {tab === "holders" && <HoldersPanel />}
            {tab === "borrow" && <BorrowPanel />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
