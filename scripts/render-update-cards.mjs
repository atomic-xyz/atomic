// Renders two 1200x675 social cards:
//   media/borrow-live.png   the Borrow tab announcement
//   media/sold-out.png      how much of each stock lending market is borrowed, from the live snapshot
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const snap = await (await fetch("https://useatomic.xyz/api/snapshot")).json();
const markets = [...snap.markets].sort((a, b) => b.borrowUSDG - a.borrowUSDG);
const supplied = markets.reduce((s, m) => s + m.supplyUSDG, 0);
const borrowed = markets.reduce((s, m) => s + m.borrowUSDG, 0);
const usd = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`);
const logo = readFileSync(new URL("../public/brand/atomic-sphere-alpha-1024.png", import.meta.url)).toString("base64");

const head = `<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@500;600&display=swap" rel="stylesheet">`;
const base = `
*{box-sizing:border-box}body{margin:0;width:1200px;height:675px;background:#050505;color:#f2f2f2;font-family:'Bricolage Grotesque',system-ui,sans-serif;overflow:hidden;position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.035) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 30% 40%,#000 15%,transparent 75%)}
.top{position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.2em;font-size:20px}.top img{width:46px;height:46px}
.eyebrow{position:absolute;left:58px;top:158px;font-family:'IBM Plex Mono',monospace;font-size:17px;letter-spacing:.26em;text-transform:uppercase;display:flex;align-items:center;gap:12px}
.dot{width:10px;height:10px;border-radius:99px}
.foot{position:absolute;left:58px;bottom:30px;font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#5e5e66}`;
const brand = `<div class="top"><img src="data:image/png;base64,${logo}">ATOMIC</div>`;

const borrowHtml = `<html><head>${head}<style>${base}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 15% 35%,rgba(255,255,255,.10),transparent 50%)}
.eyebrow{color:#c9c9d2}.dot{background:#fff;box-shadow:0 0 18px #fff}
.h{position:absolute;left:54px;top:196px;font-weight:800;font-size:112px;line-height:.96;letter-spacing:-.045em}
.h span{display:block;color:#8e8e96}
.sub{position:absolute;left:58px;top:432px;width:500px;font-family:Manrope,sans-serif;font-size:23px;line-height:1.4;color:#c9c9d2}
.flow{position:absolute;right:56px;top:150px;width:520px;display:grid;gap:12px}
.step{border:1px solid rgba(255,255,255,.16);border-radius:22px;background:linear-gradient(180deg,#131316,#0c0c0e);padding:20px 24px;display:grid;grid-template-columns:54px 1fr auto;align-items:center;gap:8px}
.step i{font-style:normal;font-family:'IBM Plex Mono',monospace;font-size:15px;color:#5e5e66}
.step b{font-size:26px;letter-spacing:-.02em}
.step span{font-family:'IBM Plex Mono',monospace;font-size:15px;color:#9a9aa2}
.arrow{text-align:center;color:#5e5e66;font-family:'IBM Plex Mono',monospace;font-size:18px;line-height:.6}
.chips{position:absolute;right:56px;bottom:74px;display:flex;gap:10px;font-family:'IBM Plex Mono',monospace;font-size:15px}
.chip{border:1px solid rgba(255,255,255,.16);border-radius:99px;padding:9px 16px;background:rgba(16,16,18,.8);color:#9a9aa2}.chip b{color:#f2f2f2;font-weight:500}
</style></head><body><div class="glow"></div><div class="grid"></div>${brand}
<div class="eyebrow"><span class="dot"></span>new tab, live</div>
<div class="h">Borrow<span>don't sell</span></div>
<div class="sub">Put up the stock you already hold. Get USDG in your wallet. Keep the upside.</div>
<div class="flow">
  <div class="step"><i>01</i><b>Put up your stock</b><span>stays in your name</span></div>
  <div class="arrow">↓</div>
  <div class="step"><i>02</i><b>Borrow USDG</b><span>lands in your wallet</span></div>
  <div class="arrow">↓</div>
  <div class="step"><i>03</i><b>Repay any time</b><span>stock comes back</span></div>
</div>
<div class="chips"><span class="chip">ATOMIC fee <b>none</b></span><span class="chip">no due date</span><span class="chip">nothing sold</span></div>
<div class="foot">useatomic.xyz</div></body></html>`;

const soldHtml = `<html><head>${head}<style>${base}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 85% 25%,rgba(240,112,112,.18),transparent 52%)}
.eyebrow{color:#f07070}.dot{background:#f07070;box-shadow:0 0 18px #f07070}
.big{position:absolute;left:52px;top:182px;font-weight:800;font-size:180px;line-height:1;letter-spacing:-.05em}
.big span{font-size:86px;color:#c9c9d2}
.sub{position:absolute;left:58px;top:376px;width:520px;font-size:33px;font-weight:700;line-height:1.15;color:#c9c9d2;letter-spacing:-.01em}
.note{position:absolute;left:58px;bottom:76px;font-family:'IBM Plex Mono',monospace;font-size:16px;color:#9a9aa2;line-height:1.7}.note b{color:#f2f2f2;font-weight:500}
.bars{position:absolute;right:56px;top:132px;width:500px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:#101012;padding:22px 24px}
.bars h4{margin:0 0 12px;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#5e5e66;font-weight:500;display:flex;justify-content:space-between}
.bar{display:grid;grid-template-columns:64px 1fr 62px 70px;align-items:center;gap:12px;margin:15px 0;font-family:'IBM Plex Mono',monospace;font-size:17px}
.track{height:12px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.track i{display:block;height:100%;border-radius:99px}
.bar span:nth-child(3){text-align:right;color:#f2f2f2}.bar span:nth-child(4){text-align:right;color:#9a9aa2;font-size:14px}
</style></head><body><div class="glow"></div><div class="grid"></div>${brand}
<div class="eyebrow"><span class="dot"></span>stock lending, right now</div>
<div class="big">${Math.round((borrowed / supplied) * 100)}<span>%</span></div>
<div class="sub">of every dollar lent against stocks is already borrowed</div>
<div class="note"><b>${usd(borrowed)}</b> borrowed out of <b>${usd(supplied)}</b> supplied</div>
<div class="bars"><h4><span>market</span><span>borrowed · rate</span></h4>
${markets.map((m) => { const u = Math.min(1, m.utilization); const c = u > 0.9 ? "#f07070" : u > 0.5 ? "#e3b869" : "#6fd6a3"; return `<div class="bar"><span>${m.symbol}</span><div class="track"><i style="width:${Math.max(2, u * 100)}%;background:${c}"></i></div><span>${(u * 100).toFixed(0)}%</span><span>${(m.borrowApy * 100).toFixed(1)}%</span></div>`; }).join("")}
</div>
<div class="foot">live from morpho, via useatomic.xyz</div></body></html>`;

const br = await chromium.launch({ channel: "chrome" });
const p = await br.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
for (const [html, out] of [[borrowHtml, "media/borrow-live.png"], [soldHtml, "media/sold-out.png"]]) {
  await p.setContent(html); await p.waitForTimeout(2200); await p.screenshot({ path: out });
}
await br.close();
console.log(JSON.stringify({ utilization: Math.round((borrowed / supplied) * 100), borrowed: Math.round(borrowed), supplied: Math.round(supplied) }));
