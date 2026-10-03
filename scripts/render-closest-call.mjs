// Renders a 1200x675 teaser card for the "closest call on the board" tweet from live Borrowers data.
// The wallet and the stock are blurred on purpose: the tweet tells people to go find it.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const res = await fetch("https://useatomic.xyz/api/borrowers");
const data = await res.json();
const b = data.borrowers.filter((x) => x.dropToLiquidation !== null && x.borrowUsd >= 5).sort((a, c) => a.dropToLiquidation - c.dropToLiquidation)[0];
const pct = Math.round(b.dropToLiquidation * 100);
const usd = (n) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
const logo = readFileSync(new URL("../public/brand/atomic-sphere-alpha-1024.png", import.meta.url)).toString("base64");
const out = process.argv[2] ?? "closest-call.png";

const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:675px;background:#050505;color:#f2f2f2;font-family:'Bricolage Grotesque',system-ui,sans-serif;overflow:hidden;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 78% 30%,rgba(240,112,112,.20),transparent 55%),radial-gradient(ellipse at 10% 100%,rgba(255,255,255,.06),transparent 50%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.035) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 60% 40%,#000 20%,transparent 75%)}
.top{position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.2em;font-size:20px}
.top img{width:46px;height:46px}
.eyebrow{position:absolute;left:56px;top:150px;font-family:'IBM Plex Mono',monospace;font-size:17px;letter-spacing:.24em;text-transform:uppercase;color:#f07070;display:flex;align-items:center;gap:12px}
.dot{width:10px;height:10px;border-radius:99px;background:#f07070;box-shadow:0 0 18px #f07070}
.big{position:absolute;left:50px;top:176px;font-weight:800;font-size:250px;line-height:1;letter-spacing:-.05em}
.big span{font-size:120px;color:#c9c9d2}
.sub{position:absolute;left:58px;top:428px;font-size:38px;font-weight:700;letter-spacing:-.02em;color:#c9c9d2}
.row{position:absolute;left:56px;right:56px;bottom:74px;height:92px;border:1px solid rgba(255,255,255,.16);border-radius:22px;background:#101012;display:flex;align-items:center;gap:22px;padding:0 26px;font-family:'IBM Plex Mono',monospace;font-size:19px}
.tile{width:48px;height:48px;border-radius:12px;background:linear-gradient(160deg,#fff,#cfd2da);filter:blur(7px)}
.blur{filter:blur(8px);color:#fff;letter-spacing:.04em}
.muted{color:#9a9aa2}.row b{color:#f2f2f2;font-weight:600}
.bar{flex:1;height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.bar i{display:block;height:100%;width:${Math.max(6, Math.min(100, (b.dropToLiquidation / 0.15) * 100))}%;background:linear-gradient(90deg,#f07070,#ff9b9b);border-radius:99px}
.tag{border:1px solid rgba(240,112,112,.5);background:rgba(240,112,112,.12);color:#f07070;border-radius:99px;padding:6px 14px;font-size:14px}
.foot{position:absolute;left:56px;bottom:30px;font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#5e5e66}
.q{position:absolute;right:70px;top:150px;font-weight:800;font-size:330px;line-height:1;color:rgba(255,255,255,.05)}
</style></head><body>
<div class="glow"></div><div class="grid"></div><div class="q">?</div>
<div class="top"><img src="data:image/png;base64,${logo}">ATOMIC</div>
<div class="eyebrow"><span class="dot"></span>closest call on the board</div>
<div class="big">${pct}<span>%</span></div>
<div class="sub">from being closed by force</div>
<div class="row">
  <div class="tile"></div>
  <span class="blur">0x7F7F...2A91</span>
  <span class="blur">XXXX</span>
  <span class="muted">holds <b>${usd(b.collateralUsd)}</b></span>
  <span class="muted">owes <b>${usd(b.borrowUsd)}</b></span>
  <span class="muted"><b>${b.leverage.toFixed(2)}x</b></span>
  <div class="bar"><i></i></div>
  <span class="tag">${pct}% to liquidation</span>
</div>
<div class="foot">borrowers board, live</div>
</body></html>`;

const br = await chromium.launch({ channel: "chrome" });
const p = await br.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
await p.setContent(html); await p.waitForTimeout(2500);
await p.screenshot({ path: out });
await br.close();
console.log(JSON.stringify({ out, pct, symbol: b.symbol, holds: b.collateralUsd, owes: b.borrowUsd, lev: b.leverage }));
