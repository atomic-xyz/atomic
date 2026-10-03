import { NextResponse } from "next/server";
import { MARKETS } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Every open borrow on the stock-collateral Morpho markets, read from Morpho's indexer
 * (blue-api.morpho.org indexes Robinhood Chain, chain id 4663), with a live profit figure.
 *
 * Profit since entry = (collateral value now - loan now) - net cash the wallet put in.
 * Net cash in is rebuilt from the wallet's market transactions: collateral supplied (valued
 * at the price when it was supplied) minus collateral withdrawn, minus USDG borrowed, plus
 * USDG repaid. Prices at each transaction come from the position's own hourly history.
 * Cost basis is cached per position and only recomputed when its transaction count changes;
 * the live side (collateral and loan value) refreshes every call.
 */

const MORPHO_API = "https://blue-api.morpho.org/graphql";
const CHAIN_ID = 4663;
const TTL_MS = 10_000;
const MAX_STALE_MS = 120_000;
const TX_TTL_MS = 60_000;

export type Borrower = {
  address: string;
  symbol: string;
  marketId: string;
  lltv: number;
  collateralUsd: number;
  borrowUsd: number;
  equityUsd: number;
  leverage: number;
  health: number | null;
  /** price fall, as a fraction, that would make the position liquidatable */
  dropToLiquidation: number | null;
  /** live profit since entry in USD, null when the history could not be priced */
  pnlUsd: number | null;
  /** profit as a fraction of the wallet's own money in */
  pnlPct: number | null;
  /** average price paid for the collateral, USD per token */
  entryPrice: number | null;
  /** the wallet's own money in the position, USD */
  cashIn: number | null;
  /** unix seconds of the first collateral supply */
  since: number | null;
};

export type BorrowersResponse = {
  at: number;
  count: number;
  totalBorrowUsd: number;
  totalCollateralUsd: number;
  totalPnlUsd: number;
  bySymbol: Record<string, { count: number; borrowUsd: number; pnlUsd: number }>;
  borrowers: Borrower[];
};

type ApiPosition = {
  user: { address: string };
  market: { collateralAsset: { symbol: string } | null; lltv: string };
  state: { collateralUsd: number | null; borrowAssetsUsd: number | null; collateral: string | null };
  healthFactor: number | null;
};

type ApiTx = {
  type: "SupplyCollateral" | "WithdrawCollateral" | "Borrow" | "Repay" | "Liquidation";
  timestamp: number;
  user: { address: string };
  market: { collateralAsset: { symbol: string } | null };
  data: { assets?: string; repaidAssets?: string; seizedAssets?: string };
};

type Basis = { cashIn: number; entryPrice: number | null; since: number | null; txCount: number };

let cache: { at: number; data: BorrowersResponse } | null = null;
let inflight: Promise<BorrowersResponse> | null = null;
let txCache: { at: number; byKey: Map<string, ApiTx[]> } | null = null;
const basisCache = new Map<string, Basis>();
const priceCache = new Map<string, number>(); // `${user}:${symbol}:${ts}:${kind}` -> price

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const r = await fetch(MORPHO_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`morpho api ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const json = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

const marketIds = () => MARKETS.map((m) => m.id);
const marketIdFor = (symbol: string) => MARKETS.find((m) => m.symbol === symbol)?.id ?? "";
const key = (user: string, symbol: string) => `${user.toLowerCase()}:${symbol}`;

async function fetchPositions(): Promise<ApiPosition[]> {
  const q = `query($ids: [String!]) {
    marketPositions(first: 200, where: { chainId_in: [${CHAIN_ID}], marketUniqueKey_in: $ids, borrowShares_gte: 1 }, orderBy: BorrowShares, orderDirection: Desc) {
      items { user { address } market { collateralAsset { symbol } lltv } state { collateralUsd borrowAssetsUsd collateral } healthFactor }
    }
  }`;
  const d = await gql<{ marketPositions: { items: ApiPosition[] } }>(q, { ids: marketIds() });
  return d.marketPositions.items;
}

async function fetchTransactions(users: string[]): Promise<Map<string, ApiTx[]>> {
  const now = Date.now();
  if (txCache && now - txCache.at < TX_TTL_MS) return txCache.byKey;
  const q = `query($ids: [String!], $users: [String!]) {
    marketTransactions(first: 500, where: { chainId_in: [${CHAIN_ID}], marketUniqueKey_in: $ids, userAddress_in: $users, type_in: [SupplyCollateral, WithdrawCollateral, Borrow, Repay, Liquidation] }, orderBy: Timestamp, orderDirection: Asc) {
      items { type timestamp user { address } market { collateralAsset { symbol } } data { ... on MarketTransactionTransferData { assets } ... on MarketTransactionCollateralTransferData { assets } ... on MarketTransactionLiquidationData { repaidAssets seizedAssets } } }
    }
  }`;
  const d = await gql<{ marketTransactions: { items: ApiTx[] } }>(q, { ids: marketIds(), users });
  const byKey = new Map<string, ApiTx[]>();
  for (const tx of d.marketTransactions.items) {
    const sym = tx.market.collateralAsset?.symbol;
    if (!sym) continue;
    const k = key(tx.user.address, sym);
    byKey.set(k, [...(byKey.get(k) ?? []), tx]);
  }
  txCache = { at: now, byKey };
  return byKey;
}

/** Prices at transaction times, from each position's hourly history in a small window around the transaction. */
async function fetchPrices(needs: { user: string; symbol: string; ts: number; kind: "after" | "before" }[]) {
  const todo = needs.filter((n) => !priceCache.has(`${n.user}:${n.symbol}:${n.ts}:${n.kind}`));
  if (!todo.length) return;
  const seen = new Set<string>();
  const uniq = todo.filter((n) => {
    const k = `${n.user}:${n.symbol}:${n.ts}:${n.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  for (let i = 0; i < uniq.length; i += 30) {
    const chunk = uniq.slice(i, i + 30);
    const parts = chunk.map((n, j) => {
      const start = n.kind === "after" ? n.ts - 60 : n.ts - 7200;
      const end = n.kind === "after" ? n.ts + 7200 : n.ts + 60;
      const opt = `(options: { startTimestamp: ${start}, endTimestamp: ${end}, interval: HOUR })`;
      return `p${j}: marketPositions(first: 1, where: { chainId_in: [${CHAIN_ID}], userAddress_in: ["${n.user}"], marketUniqueKey_in: ["${marketIdFor(n.symbol)}"] }) { items { historicalState { collateralUsd${opt} { x y } collateral${opt} { x y } } } }`;
    });
    const d = await gql<Record<string, { items: { historicalState: { collateralUsd: { x: number; y: number }[]; collateral: { x: number; y: string }[] } }[] }>>(`{ ${parts.join("\n")} }`);
    chunk.forEach((n, j) => {
      const h = d[`p${j}`]?.items?.[0]?.historicalState;
      if (!h) return;
      const usdByX = new Map(h.collateralUsd.map((p) => [p.x, p.y]));
      const pts = h.collateral
        .map((p) => ({ x: p.x, tokens: Number(p.y) / 1e18, usd: usdByX.get(p.x) ?? 0 }))
        .filter((p) => p.tokens > 0 && p.usd > 0)
        .sort((a, b) => a.x - b.x);
      const pick = n.kind === "after" ? pts.find((p) => p.x >= n.ts) ?? pts[pts.length - 1] : [...pts].reverse().find((p) => p.x < n.ts) ?? pts[0];
      if (pick) priceCache.set(`${n.user}:${n.symbol}:${n.ts}:${n.kind}`, pick.usd / pick.tokens);
    });
  }
}

function computeBasis(user: string, symbol: string, txs: ApiTx[], priceNow: number): Basis {
  let cashIn = 0;
  let supplyTokens = 0;
  let supplyUsd = 0;
  let since: number | null = null;
  for (const tx of txs) {
    const assets = Number(tx.data.assets ?? 0);
    if (tx.type === "SupplyCollateral") {
      const price = priceCache.get(`${user}:${symbol}:${tx.timestamp}:after`) ?? priceNow;
      const tokens = assets / 1e18;
      cashIn += tokens * price;
      supplyTokens += tokens;
      supplyUsd += tokens * price;
      since ??= tx.timestamp;
    } else if (tx.type === "WithdrawCollateral") {
      const price = priceCache.get(`${user}:${symbol}:${tx.timestamp}:before`) ?? priceNow;
      cashIn -= (assets / 1e18) * price;
    } else if (tx.type === "Borrow") {
      cashIn -= assets / 1e6;
    } else if (tx.type === "Repay") {
      cashIn += assets / 1e6;
    } else if (tx.type === "Liquidation") {
      const price = priceCache.get(`${user}:${symbol}:${tx.timestamp}:before`) ?? priceNow;
      cashIn -= (Number(tx.data.seizedAssets ?? 0) / 1e18) * price;
      cashIn += Number(tx.data.repaidAssets ?? 0) / 1e6;
    }
  }
  return { cashIn, entryPrice: supplyTokens > 0 ? supplyUsd / supplyTokens : null, since, txCount: txs.length };
}

async function build(): Promise<BorrowersResponse> {
  const items = await fetchPositions();
  const users = Array.from(new Set(items.map((i) => i.user.address)));

  let txByKey = new Map<string, ApiTx[]>();
  try {
    txByKey = await fetchTransactions(users);
    const needs: { user: string; symbol: string; ts: number; kind: "after" | "before" }[] = [];
    for (const [k, txs] of txByKey) {
      const cached = basisCache.get(k);
      if (cached && cached.txCount === txs.length) continue;
      for (const tx of txs) {
        if (tx.type === "SupplyCollateral") needs.push({ user: tx.user.address, symbol: tx.market.collateralAsset!.symbol, ts: tx.timestamp, kind: "after" });
        if (tx.type === "WithdrawCollateral" || tx.type === "Liquidation") needs.push({ user: tx.user.address, symbol: tx.market.collateralAsset!.symbol, ts: tx.timestamp, kind: "before" });
      }
    }
    await fetchPrices(needs);
  } catch (e) {
    // history unavailable this round: positions still render, profit shows as unknown
    console.error("[borrowers] history failed:", e instanceof Error ? e.message : e);
  }

  const borrowers: Borrower[] = [];
  for (const it of items) {
    const symbol = it.market.collateralAsset?.symbol;
    const borrowUsd = it.state.borrowAssetsUsd ?? 0;
    const collateralUsd = it.state.collateralUsd ?? 0;
    if (!symbol || borrowUsd < 0.01) continue;
    const collTokens = Number(it.state.collateral ?? 0) / 1e18;
    const priceNow = collTokens > 0 ? collateralUsd / collTokens : 0;
    const lltv = Number(it.market.lltv) / 1e18 || MARKETS.find((m) => m.symbol === symbol)?.lltv || 0;
    const equityUsd = Math.max(0, collateralUsd - borrowUsd);
    const health = it.healthFactor ?? null;

    const k = key(it.user.address, symbol);
    const txs = txByKey.get(k);
    let basis = basisCache.get(k) ?? null;
    if (txs && (!basis || basis.txCount !== txs.length)) {
      basis = computeBasis(it.user.address, symbol, txs, priceNow);
      basisCache.set(k, basis);
    }
    const pnlUsd = basis ? collateralUsd - borrowUsd - basis.cashIn : null;
    borrowers.push({
      address: it.user.address,
      symbol,
      marketId: marketIdFor(symbol),
      lltv,
      collateralUsd,
      borrowUsd,
      equityUsd,
      leverage: equityUsd > 0 ? collateralUsd / equityUsd : Infinity,
      health,
      dropToLiquidation: health && health > 0 ? Math.max(0, 1 - 1 / health) : null,
      pnlUsd,
      pnlPct: pnlUsd !== null && basis && basis.cashIn > 0.5 ? pnlUsd / basis.cashIn : null,
      entryPrice: basis?.entryPrice ?? null,
      cashIn: basis?.cashIn ?? null,
      since: basis?.since ?? null,
    });
  }
  borrowers.sort((a, b) => b.borrowUsd - a.borrowUsd);

  const bySymbol: BorrowersResponse["bySymbol"] = {};
  for (const b of borrowers) {
    bySymbol[b.symbol] ??= { count: 0, borrowUsd: 0, pnlUsd: 0 };
    bySymbol[b.symbol].count += 1;
    bySymbol[b.symbol].borrowUsd += b.borrowUsd;
    bySymbol[b.symbol].pnlUsd += b.pnlUsd ?? 0;
  }
  return {
    at: Date.now(),
    count: borrowers.length,
    totalBorrowUsd: borrowers.reduce((s, b) => s + b.borrowUsd, 0),
    totalCollateralUsd: borrowers.reduce((s, b) => s + b.collateralUsd, 0),
    totalPnlUsd: borrowers.reduce((s, b) => s + (b.pnlUsd ?? 0), 0),
    bySymbol,
    borrowers,
  };
}

async function getBorrowers(): Promise<BorrowersResponse> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.data;
  if (!inflight) {
    inflight = build()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  if (cache && now - cache.at < MAX_STALE_MS) return cache.data;
  return inflight;
}

export async function GET() {
  try {
    const data = await getBorrowers();
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (cache) return NextResponse.json(cache.data, { headers: { "cache-control": "no-store" } });
    return NextResponse.json({ error: e instanceof Error ? e.message : "borrowers failed" }, { status: 502 });
  }
}
