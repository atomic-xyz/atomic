"use client";

import { useEffect, useRef, useState } from "react";
import { useSnapshot } from "@/hooks/useSnapshot";

/** Block number that keeps ticking at the chain's 100ms cadence between snapshots. */
export function BlockClock({ className = "" }: { className?: string }) {
  const { data, dataUpdatedAt } = useSnapshot();
  const [shown, setShown] = useState<number | null>(null);
  const base = useRef<{ block: number; at: number } | null>(null);

  useEffect(() => {
    if (data) base.current = { block: data.block, at: dataUpdatedAt };
  }, [data, dataUpdatedAt]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!base.current) return;
      const elapsed = (Date.now() - base.current.at) / 100;
      setShown(base.current.block + Math.floor(elapsed));
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={`inline-flex items-center gap-2 font-mono tabular ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
      </span>
      <span className="text-muted">block</span>
      <span className="text-text">{shown ? shown.toLocaleString("en-US") : "—"}</span>
    </span>
  );
}
