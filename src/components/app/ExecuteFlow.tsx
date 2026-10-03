"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, usePublicClient } from "wagmi";
import type { Hex } from "viem";
import { EXPLORER } from "@/lib/addresses";
import { ROUTER_ADDRESS } from "@/lib/router";
import { robinhoodChain } from "@/lib/chain";
import { WalletButton } from "./WalletButton";

export interface FlowStep {
  key: string;
  label: string;
  detail?: string;
  /** Return false to skip the step (for example an allowance that already covers the amount). */
  needed: boolean;
  run: () => Promise<Hex>;
}

type Status = "idle" | "running" | "done" | "error";

/**
 * Runs a list of on-chain steps in order, waiting for each receipt, and shows what is happening.
 * Steps are built by the panel with wagmi's writeContractAsync closures.
 */
export function ExecuteFlow({ steps, label, ready, blocker, onDone, compact = false }: { steps: FlowStep[]; label: string; ready: boolean; blocker?: string; onDone?: () => void; compact?: boolean }) {
  const { isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const [status, setStatus] = useState<Status>("idle");
  const [current, setCurrent] = useState<string | null>(null);
  const [hashes, setHashes] = useState<Record<string, Hex>>({});
  const [error, setError] = useState<string | null>(null);

  const active = steps.filter((s) => s.needed);
  const wrongChain = isConnected && chainId !== robinhoodChain.id;

  const start = async () => {
    setStatus("running");
    setError(null);
    setHashes({});
    try {
      for (const s of active) {
        setCurrent(s.key);
        const hash = await s.run();
        setHashes((h) => ({ ...h, [s.key]: hash }));
        const receipt = await client!.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`${s.label} reverted on-chain`);
      }
      setStatus("done");
      setCurrent(null);
      onDone?.();
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "failed";
      setError(msg.length > 220 ? msg.slice(0, 220) + "…" : msg);
      setStatus("error");
      setCurrent(null);
    }
  };

  if (!ROUTER_ADDRESS) {
    return (
      <div>
        <button disabled className="btn-flash w-full rounded-2xl px-5 py-3.5 text-sm">Router not deployed yet</button>
        <p className="mt-2 text-center font-mono text-[11px] text-muted-2">Every number above is a live quote. Signing opens once the ATOMIC router is verified on Blockscout.</p>
      </div>
    );
  }
  if (!isConnected && compact) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg/40 px-4 py-2.5">
        <span className="text-xs text-muted">{blocker ?? label}</span>
        <WalletButton />
      </div>
    );
  }
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-bg/40 p-4">
        <span className="text-sm text-muted">Connect a wallet on Robinhood Chain to sign</span>
        <WalletButton />
      </div>
    );
  }
  if (wrongChain) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-warn/40 bg-warn/5 p-4">
        <span className="text-sm text-warn">Wrong network</span>
        <WalletButton />
      </div>
    );
  }

  return (
    <div>
      <button onClick={start} disabled={!ready || status === "running" || !!blocker} className="btn-flash w-full rounded-2xl px-5 py-3.5 text-sm">
        {status === "running" ? "Confirm in your wallet" : blocker ?? label}
      </button>
      {active.length > 1 && status === "idle" && (
        <p className="mt-2 text-center font-mono text-[11px] text-muted-2">{active.length} signatures: {active.map((s) => s.label.toLowerCase()).join(", ")}</p>
      )}
      <AnimatePresence>
        {status !== "idle" && (
          <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 grid gap-1.5 overflow-hidden">
            {active.map((s) => {
              const hash = hashes[s.key];
              const state = hash ? (current === s.key ? "confirming" : "done") : current === s.key ? "signing" : "waiting";
              return (
                <li key={s.key} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${state === "done" ? "bg-up" : state === "waiting" ? "bg-line-2" : "bg-flash blink"}`} />
                    <span className={state === "waiting" ? "text-muted" : "text-text"}>{s.label}</span>
                    {s.detail && <span className="font-mono text-[11px] text-muted-2">{s.detail}</span>}
                  </span>
                  <span className="font-mono text-[11px] text-muted">
                    {hash ? <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="text-flash hover:underline">{hash.slice(0, 10)}…</a> : state}
                  </span>
                </li>
              );
            })}
            {status === "done" && <li className="rounded-xl border border-up/40 bg-up/10 px-3 py-2 font-mono text-[11px] text-up">confirmed in one block</li>}
            {status === "error" && (
              <li className="rounded-xl border border-down/40 bg-down/10 px-3 py-2 font-mono text-[11px] text-down">
                {error}
                <button onClick={() => setStatus("idle")} className="ml-3 underline">reset</button>
              </li>
            )}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}
