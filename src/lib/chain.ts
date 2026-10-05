import { createPublicClient, defineChain, fallback, http } from "viem";

/**
 * Public RPCs for Robinhood Chain, tried in order. The official endpoint is first, but some
 * networks block it (it resolved to an ISP block page on 2026-09-25), so two independent
 * public providers sit behind it. Override with NEXT_PUBLIC_RPC_URLS as a comma-separated list.
 */
export const DEFAULT_RPC_URLS = [
  "https://robinhood.drpc.org",
  "https://robinhood-rpc.publicnode.com",
  "https://rpc.mainnet.chain.robinhood.com",
];

const ENV_RPCS = (process.env.NEXT_PUBLIC_RPC_URLS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** An explicit NEXT_PUBLIC_RPC_URLS list replaces the defaults (used to point at a local fork). */
export const RPC_URLS: string[] = ENV_RPCS.length ? ENV_RPCS : DEFAULT_RPC_URLS;

export const RPC_URL = RPC_URLS[0];

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export function rpcTransport() {
  // PublicNode answers browser origins with 403, so the client-side transport skips it.
  const urls = typeof window === "undefined" ? RPC_URLS : RPC_URLS.filter((u) => !u.includes("publicnode"));
  return fallback(
    (urls.length ? urls : RPC_URLS).map((url) =>
      http(url, {
        // dRPC's free plan rejects JSON-RPC batches of more than three requests with HTTP 500.
        batch: { batchSize: 3, wait: 8 },
        retryCount: 1,
        retryDelay: 300,
        // A local fork (anvil) lazily pulls state from upstream, so its first calls are slow.
        timeout: /127\.0\.0\.1|localhost/.test(url) ? 600_000 : 7_000,
        fetchOptions: { headers: { "User-Agent": "atomic-app/1.0" } },
      }),
    ),
    // Rank endpoints by measured latency and success so a blocked or slow one drops to the back.
    { retryCount: 0, rank: { interval: 60_000, sampleCount: 5, timeout: 4_000 } },
  );
}

let _client: ReturnType<typeof createPublicClient> | null = null;
export function publicClient() {
  if (!_client) _client = createPublicClient({ chain: robinhoodChain, transport: rpcTransport() });
  return _client;
}
