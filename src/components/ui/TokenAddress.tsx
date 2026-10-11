"use client";

import { useState } from "react";
import { ATOMIC_TOKEN, EXPLORER } from "@/lib/addresses";

/** The token's contract address with a one-click copy. `full` shows every character, otherwise 0x6564…50dd. */
export function TokenAddress({ full = false, className = "" }: { full?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const short = `${ATOMIC_TOKEN.slice(0, 6)}…${ATOMIC_TOKEN.slice(-4)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(ATOMIC_TOKEN); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked: the explorer link still works */ }
  };
  return (
    <span className={`inline-flex items-center gap-2 font-mono ${className}`}>
      <a href={`${EXPLORER}/token/${ATOMIC_TOKEN}`} target="_blank" rel="noreferrer" title={ATOMIC_TOKEN} className="hover:text-text">{full ? ATOMIC_TOKEN : short}</a>
      <button type="button" onClick={copy} aria-label="Copy the contract address" className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] transition-colors ${copied ? "border-up/60 text-up" : "border-line text-muted hover:border-line-2 hover:text-text"}`}>
        {copied ? "copied" : "copy"}
      </button>
    </span>
  );
}
