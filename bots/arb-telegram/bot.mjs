// A private Telegram bot that watches the stock pools for arbitrage that survives a real simulation.
//
// Every INTERVAL_MS it reads the public snapshot, finds pool pairs whose quoted gap is close to paying,
// simulates them through the live AtomicArb contract at several sizes (read only, nothing is sent on
// chain) and messages you when the simulated result is above MIN_PROFIT_USD. Commands let you scan on
// demand, inspect one stock's venues, and tune the thresholds.
//
// Env: TELEGRAM_BOT_TOKEN (required), ALLOWED_CHAT_IDS (comma separated; empty = the first /start claims the bot),
//      SNAPSHOT_URL, RPC_URL, ATOMIC_ARB, INTERVAL_MS, MIN_PROFIT_USD, SIZES, HOLDER (1 when your wallet holds
//      100,000 ATOMIC, so the router fee is zero), DRY (1 = one scan printed to stdout, no Telegram).
import { createPublicClient, http, parseAbi } from "viem";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const DRY = process.env.DRY === "1";
if (!TOKEN && !DRY) { console.error("TELEGRAM_BOT_TOKEN is missing"); process.exit(1); }
const SNAPSHOT = process.env.SNAPSHOT_URL ?? "https://useatomic.xyz/api/snapshot";
const POOLS_URL = process.env.POOLS_URL ?? "https://raw.githubusercontent.com/atomic-xyz/atomic/main/src/data/pools.json";
const RPC = process.env.RPC_URL ?? "https://robinhood.drpc.org";
const ARB = process.env.ATOMIC_ARB ?? "0x65Db7Bf6Bc52C4725117f7490617b13d7a8e3fB9";
const APP = "https://useatomic.xyz/app?tab=arb";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const WETH_USDG_POOL = "0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca";
const POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
const ZERO = "0x0000000000000000000000000000000000000000";
const V3_STYLE = new Set(["uniswap-v3-robinhood", "ramses-v3-robinhood", "sushiswap-v3-robinhood", "giga-v3", "up-v3", "alandale-cl"]);
const FEE_BPS = process.env.HOLDER === "1" ? 0 : 5; // ATOMIC fee on the flash size, waived for holders

const state = {
  interval: Number(process.env.INTERVAL_MS ?? 15_000),
  minProfit: Number(process.env.MIN_PROFIT_USD ?? 0.25),
  minEdge: Number(process.env.MIN_EDGE ?? -0.0005),
  sizes: (process.env.SIZES ?? "50,250,1000,5000").split(",").map(Number).filter((n) => n > 0),
  maxSims: Number(process.env.MAX_SIMS ?? 90),
  watching: true,
  chats: new Set((process.env.ALLOWED_CHAT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)),
  rounds: 0, sims: 0, hits: 0, started: Date.now(), lastRound: null, best: null,
  cooldown: new Map(), // pair key -> last alert time
};

const arbAbi = parseAbi([
  "struct Hop { address pool; address tokenIn; address tokenOut; uint24 fee; int24 tickSpacing; address hooks; }",
  "function arb(uint256 size, Hop[] buyPath, Hop[] sellPath, uint256 minProfit) returns (uint256 profit)",
]);
const client = createPublicClient({ transport: http(RPC, { retryCount: 2, retryDelay: 400, timeout: 20_000 }) });

let pools = [];
let stockOf = {};
let v4Of = {};
async function loadPools() {
  const res = await fetch(POOLS_URL, { signal: AbortSignal.timeout(30_000) });
  pools = await res.json();
  stockOf = Object.fromEntries(pools.map((p) => [p.symbol, p.stock]));
  v4Of = Object.fromEntries(pools.filter((p) => p.v4).map((p) => [p.pool.toLowerCase(), p.v4]));
}

const v3 = (pool, tokenIn) => ({ pool, tokenIn, tokenOut: ZERO, fee: 0, tickSpacing: 0, hooks: ZERO });
const v4Key = (v) => v.v4 ?? v4Of[String(v.pool).toLowerCase()];
const tradable = (v) => V3_STYLE.has(v.dex) || (v.dex === "uniswap-v4-robinhood" && v4Key(v) && v.quote === "USDG");
function hops(v, stock, side) {
  if (v.dex === "uniswap-v4-robinhood") {
    const k = v4Key(v);
    const [tokenIn, tokenOut] = side === "buy" ? [USDG, stock] : [stock, USDG];
    return [{ pool: POOL_MANAGER, tokenIn, tokenOut, fee: k.fee, tickSpacing: k.tickSpacing, hooks: k.hooks }];
  }
  if (v.quote === "USDG") return [v3(v.pool, side === "buy" ? USDG : stock)];
  return side === "buy" ? [v3(WETH_USDG_POOL, USDG), v3(v.pool, WETH)] : [v3(v.pool, stock), v3(WETH_USDG_POOL, WETH)];
}
const name = (v) => `${v.dex.replace("-robinhood", "")} ${((v.fee ?? 0) / 1e4).toFixed(2)}% ${v.quote}`;
const usd = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toFixed(Math.abs(n) < 10 ? 2 : 0);

/** Simulate one pair at one size. Returns { gross, net } in USD; gross is before the ATOMIC fee. */
async function simulate(j) {
  const stock = stockOf[j.symbol];
  if (!stock) return null;
  try {
    const r = await client.simulateContract({ address: ARB, abi: arbAbi, functionName: "arb", account: "0x1111111111111111111111111111111111111111", args: [BigInt(j.size) * 1_000_000n, hops(j.b, stock, "buy"), hops(j.s, stock, "sell"), 0n] });
    const net = Number(r.result) / 1e6;
    return { gross: net + (j.size * 5) / 10_000, net: net + (j.size * (5 - FEE_BPS)) / 10_000 };
  } catch (e) {
    const m = JSON.stringify(e, (k, v) => (typeof v === "bigint" ? v.toString() : v)).match(/0x2c19b8b8([0-9a-f]{64})([0-9a-f]{64})/i);
    if (!m) return null;
    const gross = Number(BigInt("0x" + m[1])) / 1e6 - j.size; // what the round trip returned before the fee
    return { gross, net: gross - (j.size * FEE_BPS) / 10_000 };
  }
}

/** One scan: every near-paying pair, simulated. Returns rows sorted by net result. */
async function scan(onlySymbol) {
  const snap = await (await fetch(SNAPSHOT, { signal: AbortSignal.timeout(30_000) })).json();
  const bySym = new Map();
  for (const v of snap.venues) if (tradable(v) && (!onlySymbol || v.symbol === onlySymbol)) bySym.set(v.symbol, [...(bySym.get(v.symbol) ?? []), v]);
  const pairs = [];
  for (const [symbol, venues] of bySym) for (const b of venues) for (const s of venues) {
    if (b === s) continue;
    const edge = s.price / b.price - 1 - ((b.fee ?? 3000) + (s.fee ?? 3000)) / 1e6;
    if (edge >= (onlySymbol ? -1 : state.minEdge)) pairs.push({ symbol, b, s, edge });
  }
  pairs.sort((x, y) => y.edge - x.edge);
  const jobs = [];
  for (const p of pairs.slice(0, Math.ceil(state.maxSims / state.sizes.length))) for (const size of state.sizes) jobs.push({ ...p, size });
  const rows = [];
  for (let i = 0; i < jobs.length; i += 3) {
    await Promise.all(jobs.slice(i, i + 3).map(async (j) => { state.sims++; const r = await simulate(j); if (r) rows.push({ ...j, ...r }); }));
  }
  rows.sort((x, y) => y.net - x.net);
  state.rounds++; state.lastRound = { at: Date.now(), block: snap.block, pairs: pairs.length, rows: rows.length };
  if (rows[0] && (!state.best || rows[0].net > state.best.net)) state.best = { ...rows[0], at: Date.now() };
  return { snap, rows };
}

const fmtRow = (r) => `${r.symbol} $${r.size}: net ${usd(r.net)} (gross ${usd(r.gross)}, quoted ${(r.edge * 100).toFixed(2)}%)\n  buy ${name(r.b)} → sell ${name(r.s)}`;

// ---- Telegram -------------------------------------------------------------------------------------
async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(40_000) });
  return res.json();
}
const send = (chatId, text) => tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
const broadcast = (text) => Promise.all([...state.chats].map((c) => send(c, text)));

async function handle(msg) {
  const chatId = String(msg.chat.id);
  const text = (msg.text ?? "").trim();
  const [cmd, ...args] = text.split(/\s+/);
  if (cmd === "/start") {
    if (state.chats.size === 0) { state.chats.add(chatId); await send(chatId, `Claimed. This bot now reports to you only (chat ${chatId}). Put ALLOWED_CHAT_IDS=${chatId} in the env so a restart keeps it.`); }
    else if (!state.chats.has(chatId)) return send(chatId, "This bot is private.");
    return send(chatId, help());
  }
  if (!state.chats.has(chatId)) return;
  switch (cmd) {
    case "/help": return send(chatId, help());
    case "/status": {
      const up = Math.round((Date.now() - state.started) / 60000);
      const last = state.lastRound ? `last round ${Math.round((Date.now() - state.lastRound.at) / 1000)}s ago at block ${state.lastRound.block.toLocaleString("en-US")}, ${state.lastRound.pairs} pairs near paying` : "no round yet";
      const best = state.best ? `best so far ${fmtRow(state.best)}` : "no simulated result yet";
      return send(chatId, `watching: ${state.watching ? "on" : "off"}\nevery ${state.interval / 1000}s, alert above ${usd(state.minProfit)} net, sizes ${state.sizes.join("/")}\nfee ${FEE_BPS} bps${FEE_BPS === 0 ? " (holder)" : ""}\n${state.rounds} rounds, ${state.sims} simulations, ${state.hits} alerts, up ${up}m\n${last}\n${best}`);
    }
    case "/scan": {
      const sym = args[0]?.toUpperCase();
      await send(chatId, sym ? `Simulating every ${sym} pair…` : "Simulating every pair that is near paying…");
      try {
        const { rows } = await scan(sym);
        const paying = rows.filter((r) => r.net > 0);
        if (!paying.length) return send(chatId, rows.length ? `None pays. ${rows.length} simulations, closest was ${rows[0].symbol} at $${rows[0].size} (${usd(rows[0].net)} net). Quoted gaps on thin pools vanish the moment you size them.` : "Nothing close to paying right now.");
        const top = paying.slice(0, 6).map(fmtRow).join("\n\n");
        return send(chatId, `Pays by simulation:\n\n${top}\n\nTake it: ${APP}&symbol=${paying[0].symbol}`);
      } catch (e) { return send(chatId, `Scan failed: ${e.message}`); }
    }
    case "/route": {
      const sym = args[0]?.toUpperCase();
      if (!sym) return send(chatId, "Usage: /route NVDA");
      try {
        const snap = await (await fetch(SNAPSHOT, { signal: AbortSignal.timeout(30_000) })).json();
        const vs = snap.venues.filter((v) => v.symbol === sym).sort((a, b) => b.tvl - a.tvl);
        if (!vs.length) return send(chatId, `No priced pools for ${sym}.`);
        const feed = snap.feeds[sym]?.price;
        const lines = vs.map((v) => `${tradable(v) ? "•" : "○"} ${name(v)}: $${v.price.toFixed(2)} (${((v.price / feed - 1) * 100).toFixed(2)}% vs feed), tvl ${usd(v.tvl)}`);
        return send(chatId, `${sym} feed $${feed?.toFixed(2)}\n${lines.join("\n")}\n\n• tradable through the contract, ○ watch only. /scan ${sym} simulates the pairs.`);
      } catch (e) { return send(chatId, `Failed: ${e.message}`); }
    }
    case "/min": { const n = Number(args[0]); if (!(n >= 0)) return send(chatId, "Usage: /min 0.5"); state.minProfit = n; return send(chatId, `Alerting above ${usd(n)} net.`); }
    case "/sizes": { const s = (args[0] ?? "").split(",").map(Number).filter((n) => n > 0); if (!s.length) return send(chatId, "Usage: /sizes 50,250,1000"); state.sizes = s; return send(chatId, `Sizes: ${s.join(", ")}`); }
    case "/watch": { state.watching = args[0] !== "off"; return send(chatId, `Watching ${state.watching ? "on" : "off"}.`); }
    default: return send(chatId, help());
  }
}
const help = () => `ATOMIC arbitrage watcher\n/scan [SYM] simulate now, top results\n/route SYM every pool for a stock\n/status what the watcher has seen\n/min <usd> alert threshold (now ${usd(state.minProfit)})\n/sizes 50,250,1000 sizes to simulate\n/watch on|off\n\nAlerts fire only when a simulated trade nets more than the threshold after pool fees, price impact and the ATOMIC fee.`;

async function poll() {
  let offset = 0;
  for (;;) {
    try {
      const r = await tg("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
      for (const u of r.result ?? []) { offset = u.update_id + 1; if (u.message?.text) handle(u.message).catch((e) => console.error("handle", e.message)); }
    } catch (e) { console.error("poll", e.message); await new Promise((r) => setTimeout(r, 3000)); }
  }
}

async function watchLoop() {
  for (;;) {
    if (state.watching && state.chats.size) {
      try {
        const { rows } = await scan();
        for (const r of rows) {
          if (r.net < state.minProfit) break;
          const key = `${r.symbol}|${r.b.pool}|${r.s.pool}`;
          const last = state.cooldown.get(key) ?? 0;
          if (Date.now() - last < 10 * 60_000) continue;
          state.cooldown.set(key, Date.now()); state.hits++;
          await broadcast(`Gap that pays, by simulation:\n${fmtRow(r)}\nTake it: ${APP}&symbol=${r.symbol}`);
        }
      } catch (e) { console.error("watch", e.message); }
    }
    await new Promise((r) => setTimeout(r, state.interval));
  }
}

await loadPools();
setInterval(() => loadPools().catch(() => {}), 6 * 3600_000);
if (DRY) {
  const { rows } = await scan(process.argv[2]?.toUpperCase());
  console.log(`${state.sims} simulations`);
  console.log(rows.slice(0, 8).map(fmtRow).join("\n\n") || "nothing near paying");
  process.exit(0);
}
console.log(`watcher up: every ${state.interval / 1000}s, alert above $${state.minProfit}, chats ${[...state.chats].join(",") || "(none yet, send /start)"}`);
poll();
watchLoop();
