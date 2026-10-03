// Renders two 1200x675 social cards from the live Borrowers board:
//   media/board-whale.png       the largest wallet on the board (address hidden)
//   media/board-scoreboard.png  how many positions are winning, and where the borrowing sits
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const data = await (await fetch("https://useatomic.xyz/api/borrowers")).json();
const B = data.borrowers;
const usd = (n) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`);
const logo = readFileSync(new URL("../public/brand/atomic-sphere-alpha-1024.png", import.meta.url)).toString("base64");

const wallets = new Map();
for (const b of B) {
  const w = wallets.get(b.address) ?? { coll: 0, owes: 0, pnl: 0, pos: [] };
  w.coll += b.collateralUsd; w.owes += b.borrowUsd; w.pnl += b.pnlUsd ?? 0; w.pos.push(b);
  wallets.set(b.address, w);
}
const whale = [...wallets.values()].sort((a, b) => b.coll - a.coll)[0];
const share = Math.round((whale.coll / data.totalCollateralUsd) * 100);
const winners = B.filter((b) => (b.pnlUsd ?? 0) > 0).length;
const losers = B.filter((b) => (b.pnlUsd ?? 0) < 0).length;
const bySym = Object.entries(data.bySymbol).sort((a, b) => b[1].borrowUsd - a[1].borrowUsd).slice(0, 5);
const maxBorrow = bySym[0][1].borrowUsd;

const base = `
*{box-sizing:border-box}body{margin:0;width:1200px;height:675px;background:#050505;color:#f2f2f2;font-family:'Bricolage Grotesque',system-ui,sans-serif;overflow:hidden;position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.035) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 70% 30%,#000 15%,transparent 75%)}
.top{position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.2em;font-size:20px}
.top img{width:46px;height:46px}
.eyebrow{position:absolute;left:58px;top:146px;font-family:'IBM Plex Mono',monospace;font-size:17px;letter-spacing:.26em;text-transform:uppercase;display:flex;align-items:center;gap:12px}
.dot{width:10px;height:10px;border-radius:99px}
.foot{position:absolute;left:58px;bottom:30px;font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#5e5e66}
.mono{font-family:'IBM Plex Mono',monospace}`;
const head = `<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;
const brand = `<div class="top"><img src="data:image/png;base64,${logo}">ATOMIC</div>`;

const whaleHtml = `<html><head>${head}<style>${base}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 80% 30%,rgba(111,214,163,.20),transparent 55%)}
.eyebrow{color:#6fd6a3}.dot{background:#6fd6a3;box-shadow:0 0 18px #6fd6a3}
.big{position:absolute;left:52px;top:176px;font-weight:800;font-size:170px;line-height:1;letter-spacing:-.05em}
.sub{position:absolute;left:58px;top:356px;font-size:34px;font-weight:700;color:#c9c9d2;letter-spacing:-.01em}
.stats{position:absolute;left:56px;right:56px;bottom:74px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.stat{border:1px solid rgba(255,255,255,.14);border-radius:20px;background:#101012;padding:18px 20px}
.stat small{display:block;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#5e5e66}
.stat b{display:block;margin-top:8px;font-family:'IBM Plex Mono',monospace;font-size:30px;font-weight:600}
.up{color:#6fd6a3}
.who{position:absolute;right:60px;top:150px;text-align:right;font-family:'IBM Plex Mono',monospace;font-size:15px;color:#5e5e66;letter-spacing:.12em}
.who span{display:block;margin-top:8px;font-size:26px;color:#fff;filter:blur(9px)}
</style></head><body><div class="glow"></div><div class="grid"></div>${brand}
<div class="eyebrow"><span class="dot"></span>one wallet</div>
<div class="who">WALLET<span>0x4987…C7CB</span></div>
<div class="big">${usd(whale.coll)}</div>
<div class="sub">in leveraged stock positions, ${share}% of the whole board</div>
<div class="stats">
  <div class="stat"><small>positions</small><b>${whale.pos.length} stocks</b></div>
  <div class="stat"><small>borrowed</small><b>${usd(whale.owes)}</b></div>
  <div class="stat"><small>open profit</small><b class="up">+${usd(whale.pnl)}</b></div>
  <div class="stat"><small>leverage</small><b>${(whale.coll / (whale.coll - whale.owes)).toFixed(2)}x</b></div>
</div>
<div class="foot">borrowers board, live</div></body></html>`;

const scoreHtml = `<html><head>${head}<style>${base}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 20% 20%,rgba(111,214,163,.14),transparent 50%),radial-gradient(ellipse at 90% 80%,rgba(240,112,112,.12),transparent 50%)}
.eyebrow{color:#c9c9d2}.dot{background:#f2f2f2;box-shadow:0 0 18px #fff}
.score{position:absolute;left:54px;top:182px;display:flex;align-items:baseline;gap:26px;font-weight:800;line-height:1;letter-spacing:-.05em}
.score .w{font-size:190px;color:#6fd6a3}.score .l{font-size:190px;color:#f07070}.score .v{font-size:60px;color:#5e5e66;letter-spacing:0}
.lab{position:absolute;left:60px;top:378px;display:flex;gap:150px;font-family:'IBM Plex Mono',monospace;font-size:17px;letter-spacing:.2em;text-transform:uppercase;color:#9a9aa2}
.bars{position:absolute;right:56px;top:150px;width:470px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:#101012;padding:22px 24px}
.bars h4{margin:0 0 14px;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#5e5e66;font-weight:500}
.bar{display:grid;grid-template-columns:70px 1fr 84px;align-items:center;gap:12px;margin:11px 0;font-family:'IBM Plex Mono',monospace;font-size:17px}
.bar i{display:block;height:10px;border-radius:99px;background:linear-gradient(90deg,#fff,#8e8e96)}
.bar span:last-child{text-align:right;color:#c9c9d2}
.tot{position:absolute;left:56px;bottom:74px;display:flex;gap:14px;font-family:'IBM Plex Mono',monospace;font-size:17px}
.chip{border:1px solid rgba(255,255,255,.16);border-radius:99px;padding:10px 18px;background:rgba(16,16,18,.8);color:#9a9aa2}.chip b{color:#f2f2f2;font-weight:500}
</style></head><body><div class="glow"></div><div class="grid"></div>${brand}
<div class="eyebrow"><span class="dot"></span>the board, right now</div>
<div class="score"><span class="w">${winners}</span><span class="v">vs</span><span class="l">${losers}</span></div>
<div class="lab"><span>in profit</span><span>in loss</span></div>
<div class="bars"><h4>borrowed against, by stock</h4>
${bySym.map(([s, v]) => `<div class="bar"><span>${s}</span><i style="width:${Math.max(4, (v.borrowUsd / maxBorrow) * 100)}%"></i><span>${usd(v.borrowUsd)}</span></div>`).join("")}
</div>
<div class="tot"><span class="chip"><b>${data.count}</b> open positions</span><span class="chip"><b>${usd(data.totalCollateralUsd)}</b> in stock</span><span class="chip">open profit <b>+${usd(data.totalPnlUsd)}</b></span></div>
<div class="foot">borrowers board, live</div></body></html>`;

const br = await chromium.launch({ channel: "chrome" });
const p = await br.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
for (const [html, out] of [[whaleHtml, "media/board-whale.png"], [scoreHtml, "media/board-scoreboard.png"]]) {
  await p.setContent(html); await p.waitForTimeout(2200); await p.screenshot({ path: out });
}
await br.close();
console.log(JSON.stringify({ whale: { coll: Math.round(whale.coll), owes: Math.round(whale.owes), pnl: Math.round(whale.pnl), positions: whale.pos.length, share }, winners, losers, count: data.count }));
