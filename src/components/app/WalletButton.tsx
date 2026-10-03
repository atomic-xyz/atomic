"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { robinhoodChain } from "@/lib/chain";
import { shortAddr } from "@/lib/math";

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const wrongChain = isConnected && chainId !== robinhoodChain.id;

  if (!isConnected) {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    return (
      <button onClick={() => injected && connect({ connector: injected })} disabled={isPending || !injected} className="btn-flash rounded-full px-4 py-2 text-sm">
        {isPending ? "Connecting" : "Connect wallet"}
      </button>
    );
  }
  if (wrongChain) {
    return (
      <button onClick={() => switchChain({ chainId: robinhoodChain.id })} disabled={switching} className="rounded-full border border-warn/50 bg-warn/10 px-4 py-2 text-sm text-warn">
        {switching ? "Switching" : "Switch to Robinhood Chain"}
      </button>
    );
  }
  return (
    <button onClick={() => disconnect()} className="btn-ghost group inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-up" />
      {shortAddr(address!)}
      <span className="hidden text-muted-2 group-hover:inline">disconnect</span>
    </button>
  );
}
