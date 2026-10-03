// Regenerates src/data/*.json from live sources: Robinhood Chain RPC, Chainlink's
// reference directory and GeckoTerminal. Run with `node scripts/pull-data.mjs`.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { createPublicClient, http, fallback, defineChain, parseAbi, decodeEventLog } from "viem";

const RPCS = (process.env.RPC_URLS ?? "https://rpc.mainnet.chain.robinhood.com,https://robinhood-rpc.publicnode.com,https://robinhood.drpc.org").split(",");
const RPC = RPCS[0];
const STOCK_FACTORY = "0x4783C67b63dE2B358Ac5951a7D41F47A38F3C046";
const MORPHO = "0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010";
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";

const chain = defineChain({
  id: 4663, name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: RPCS } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
const client = createPublicClient({ chain, transport: fallback(RPCS.map((u) => http(u, { fetchOptions: { headers: { "User-Agent": "atomic-data/1.0" } }, retryCount: 2, retryDelay: 1500 }))) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Event logs: public RPCs differ in what block ranges they allow. Try a full-range query on each
// endpoint first (the official node and PublicNode allow it); if every endpoint refuses, fall back
// to walking forward from the last indexed block in 10k-block chunks, which is what dRPC allows.
const LOG_RPCS = ["https://rpc.mainnet.chain.robinhood.com", "https://robinhood-rpc.publicnode.com", ...RPCS];
async function getLogsAnyRange(params, sinceBlock) {
  for (const url of [...new Set(LOG_RPCS)]) {
    try {
      const c = createPublicClient({ chain, transport: http(url, { retryCount: 0, timeout: 90_000 }) });
      return await c.getLogs({ ...params, fromBlock: 0n, toBlock: "latest" });
    } catch (e) { console.log("full-range logs refused by", url, "-", String(e.message).slice(0, 80)); }
  }
  if (sinceBlock === undefined) throw new Error("no endpoint serves full-range logs and there is no previous index to continue from");
  const walker = createPublicClient({ chain, transport: http("https://robinhood.drpc.org", { retryCount: 3, retryDelay: 1000, timeout: 60_000 }) });
  const latest = await walker.getBlockNumber();
  const out = [];
  const STEP = 5_000n;
  try {
    for (let from = BigInt(sinceBlock) + 1n; from <= latest; from += STEP) {
      const to = from + STEP - 1n > latest ? latest : from + STEP - 1n;
      out.push(...(await walker.getLogs({ ...params, fromBlock: from, toBlock: to })));
      await sleep(120);
    }
  } catch (e) {
    // Free-tier endpoints also refuse old ranges. Keep the previous index; totals, pools and feeds still refresh.
    console.log("incremental log walk refused, keeping the previous index -", String(e.message).slice(0, 60));
    return null;
  }
  console.log("incremental logs since block", sinceBlock, ":", out.length);
  return out;
}
const prevMeta = existsSync("src/data/meta.json") ? JSON.parse(readFileSync("src/data/meta.json", "utf8")) : null;
const prevStocks = existsSync("src/data/stocks.json") ? JSON.parse(readFileSync("src/data/stocks.json", "utf8")) : [];
const prevMarkets = existsSync("src/data/markets.json") ? JSON.parse(readFileSync("src/data/markets.json", "utf8")) : [];

// 1. Stock tokens ------------------------------------------------------------
const deployedAbi = parseAbi(["event Deployed(bytes32 indexed uid, address stock, string name, string symbol)"]);
const rawLogsMaybe = await getLogsAnyRange({ address: STOCK_FACTORY }, prevMeta?.block);
const rawLogs = rawLogsMaybe ?? [];
const stocks = prevMeta && (rawLogsMaybe === null || (rawLogs.length && rawLogs[0].blockNumber > BigInt(prevMeta.block))) ? [...prevStocks] : [];
for (const log of rawLogs) {
  try {
    const { args } = decodeEventLog({ abi: deployedAbi, data: log.data, topics: log.topics });
    if (!args.symbol) continue;
    const name = args.name.replace(/\s*\S?\s*Robinhood Token$/u, "").replace(/[^\x20-\x7E]/g, "").trim();
    if (!stocks.some((x) => x.address === args.stock.toLowerCase())) stocks.push({ symbol: args.symbol, name, address: args.stock.toLowerCase(), block: Number(log.blockNumber) });
  } catch { /* factory emits two non-Deployed events */ }
}
console.log("stocks:", stocks.length);
const stockByAddr = new Map(stocks.map((s) => [s.address, s]));

// 2. Chainlink feeds ---------------------------------------------------------
const feedsRaw = await (await fetch("https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json")).json();
const feeds = {};
for (const f of feedsRaw) {
  const m = /^(?:Robinhood )?([A-Za-z]+)\s*[\/-]\s*USD$/.exec(f.name || "");
  if (!m) continue;
  feeds[m[1].toUpperCase()] = { address: f.proxyAddress, decimals: f.decimals, name: f.name };
}
console.log("feeds:", Object.keys(feeds).length);

// 3. Pools (GeckoTerminal) ---------------------------------------------------
const pools = []; const seen = new Set();
const feeFromName = (n) => { const m = /([\d.]+)%/.exec(n); return m ? Math.round(parseFloat(m[1]) * 10000) : null; };
for (let page = 1; page <= 15; page++) {
  let data = null;
  for (let attempt = 0; attempt < 6 && !data; attempt++) {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/pools?page=${page}&sort=h24_volume_usd_desc`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) data = (await res.json()).data;
    else await sleep(4000 * (attempt + 1));
  }
  if (!data) { console.log("gecko page", page, "unavailable, stopping"); break; }
  if (!data.length) break;
  for (const x of data) {
    const a = x.attributes, r = x.relationships;
    const base = r.base_token.data.id.split("_").pop().toLowerCase();
    const quote = r.quote_token.data.id.split("_").pop().toLowerCase();
    const stock = stockByAddr.has(base) ? base : stockByAddr.has(quote) ? quote : null;
    if (!stock || seen.has(a.address)) continue;
    const other = stock === base ? quote : base;
    if (other !== USDG && other !== WETH) continue;
    seen.add(a.address);
    pools.push({
      symbol: stockByAddr.get(stock).symbol, stock, quote: other === USDG ? "USDG" : "WETH",
      dex: r.dex?.data?.id ?? "unknown", pool: a.address, name: a.name, fee: feeFromName(a.name),
      tvl: Math.round(parseFloat(a.reserve_in_usd || "0")), vol24: Math.round(parseFloat(a.volume_usd?.h24 || "0")),
    });
  }
  await sleep(900);
}
// Second pass: every stock that has a Chainlink feed or a live market gets a targeted lookup, which
// does not depend on where its pools rank in the global volume list.
const feedSymbols = new Set(Object.keys(feeds));
const targets = stocks.filter((st) => feedSymbols.has(st.symbol) || prevMarkets.some((m) => m.symbol === st.symbol));
for (const st of targets) {
  let data = null;
  for (let attempt = 0; attempt < 6 && !data; attempt++) {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${st.address}/pools?page=1`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) data = (await res.json()).data;
    else if (res.status === 404) data = [];
    else await sleep(4000 * (attempt + 1));
  }
  for (const x of data ?? []) {
    const a = x.attributes, r = x.relationships;
    const base = r.base_token.data.id.split("_").pop().toLowerCase();
    const quote = r.quote_token.data.id.split("_").pop().toLowerCase();
    const stock = base === st.address ? base : quote === st.address ? quote : null;
    if (!stock || seen.has(a.address)) continue;
    const other = stock === base ? quote : base;
    if (other !== USDG && other !== WETH) continue;
    seen.add(a.address);
    pools.push({
      symbol: st.symbol, stock, quote: other === USDG ? "USDG" : "WETH",
      dex: r.dex?.data?.id ?? "unknown", pool: a.address, name: a.name, fee: feeFromName(a.name),
      tvl: Math.round(parseFloat(a.reserve_in_usd || "0")), vol24: Math.round(parseFloat(a.volume_usd?.h24 || "0")),
    });
  }
  await sleep(1200);
}
pools.sort((a, b) => b.vol24 - a.vol24);
console.log("stock pools:", pools.length);

// 4. Morpho markets ----------------------------------------------------------
const morphoAbi = parseAbi([
  "event CreateMarket(bytes32 indexed id, (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams)",
  "function market(bytes32) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
]);
const mLogs = (await getLogsAnyRange({ address: MORPHO, event: morphoAbi[0] }, prevMeta?.block)) ?? [];
const fromLogs = mLogs
  .map((l) => ({ id: l.args.id, loanToken: l.args.marketParams.loanToken, collateralToken: l.args.marketParams.collateralToken, oracle: l.args.marketParams.oracle, irm: l.args.marketParams.irm, lltv: l.args.marketParams.lltv, block: Number(l.blockNumber) }))
  .filter((m) => m.loanToken.toLowerCase() === USDG && stockByAddr.has(m.collateralToken.toLowerCase()));
// Previously known markets are re-read too (their totals change), new ones are appended.
const known = new Map(prevMarkets.map((m) => [m.id, { id: m.id, loanToken: USDG, collateralToken: m.collateral, oracle: m.oracle, irm: m.irm, lltv: BigInt(Math.round(m.lltv * 1e18)), block: 0 }]));
for (const m of fromLogs) known.set(m.id, m);
const candidates = [...known.values()];
const markets = [];
for (let i = 0; i < candidates.length; i += 20) {
  const chunk = candidates.slice(i, i + 20);
  const res = await client.multicall({ contracts: chunk.map((m) => ({ address: MORPHO, abi: morphoAbi, functionName: "market", args: [m.id] })) });
  chunk.forEach((m, j) => {
    const r = res[j].result; if (!r) return;
    const supply = Number(r[0]) / 1e6, borrow = Number(r[2]) / 1e6;
    if (supply < 1000) return;
    markets.push({ id: m.id, symbol: stockByAddr.get(m.collateralToken.toLowerCase()).symbol, collateral: m.collateralToken.toLowerCase(), oracle: m.oracle, irm: m.irm, lltv: Number(m.lltv) / 1e18, supplyUSDG: Math.round(supply), borrowUSDG: Math.round(borrow) });
  });
  await sleep(700);
}
markets.sort((a, b) => b.supplyUSDG - a.supplyUSDG);
console.log("live stock markets:", markets.length);

const stamp = { generatedAt: new Date().toISOString(), block: Number(await client.getBlockNumber()) };
writeFileSync("src/data/stocks.json", JSON.stringify(stocks, null, 1));
writeFileSync("src/data/feeds.json", JSON.stringify(feeds, null, 1));
writeFileSync("src/data/pools.json", JSON.stringify(pools, null, 1));
writeFileSync("src/data/markets.json", JSON.stringify(markets, null, 1));
writeFileSync("src/data/meta.json", JSON.stringify(stamp, null, 1));
console.log("written", stamp);
