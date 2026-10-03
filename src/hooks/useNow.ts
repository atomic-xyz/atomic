"use client";

import { useEffect, useState } from "react";

/** Wall-clock that ticks once per second, so "x seconds ago" labels re-render without impure reads. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
