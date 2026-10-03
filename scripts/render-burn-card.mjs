// Renders a 1200x675 card announcing a token burn. Figures are passed in from the on-chain receipt.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const amount = Number(process.argv[2]);          // tokens burned, whole units
const supply = Number(process.argv[3]);          // total supply, whole units
const tx = process.argv[4];
const out = process.argv[5] ?? "burn.png";
const pct = ((amount / supply) * 100).toFixed(2);
const logo = readFileSync(new URL("../public/brand/atomic-sphere-alpha-1024.png", import.meta.url)).toString("base64");
const n = Math.round(amount).toLocaleString("en-US");

// ember particles, deterministic so the render is repeatable
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const embers = Array.from({ length: 70 }, () => {
  const x = 520 + rnd() * 660, y = 40 + rnd() * 600, s = 1.5 + rnd() * 4.5, o = 0.15 + rnd() * 0.7;
  return `<i style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;opacity:${o.toFixed(2)}"></i>`;
}).join("");

const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:675px;background:#050505;color:#f2f2f2;font-family:'Bricolage Grotesque',system-ui,sans-serif;overflow:hidden;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 82% 62%,rgba(255,138,61,.34),transparent 46%),radial-gradient(ellipse at 74% 78%,rgba(255,210,150,.16),transparent 38%),radial-gradient(ellipse at 8% 0%,rgba(255,255,255,.07),transparent 45%)}
.embers i{position:absolute;border-radius:99px;background:#ffb070;box-shadow:0 0 10px 2px rgba(255,150,70,.7)}
.mark{position:absolute;right:-70px;top:70px;width:560px;height:560px;opacity:.9;filter:drop-shadow(0 0 60px rgba(255,150,70,.45)) saturate(1.1);mask-image:linear-gradient(to top,transparent 6%,#000 55%);-webkit-mask-image:linear-gradient(to top,transparent 6%,#000 55%)}
.top{position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.2em;font-size:20px}
.top img{width:46px;height:46px}
.eyebrow{position:absolute;left:58px;top:168px;font-family:'IBM Plex Mono',monospace;font-size:17px;letter-spacing:.26em;text-transform:uppercase;color:#ff9a57;display:flex;align-items:center;gap:12px}
.dot{width:10px;height:10px;border-radius:99px;background:#ff9a57;box-shadow:0 0 18px #ff9a57}
.big{position:absolute;left:52px;top:204px;font-weight:800;font-size:128px;line-height:1;letter-spacing:-.045em}
.unit{position:absolute;left:58px;top:342px;font-size:44px;font-weight:800;letter-spacing:.02em;color:#c9c9d2}
.pct{position:absolute;left:58px;top:420px;font-size:30px;font-weight:700;color:#f2f2f2}
.pct b{color:#ff9a57}
.row{position:absolute;left:56px;bottom:70px;display:flex;gap:14px;font-family:'IBM Plex Mono',monospace;font-size:16px}
.chip{border:1px solid rgba(255,255,255,.16);border-radius:99px;padding:10px 18px;background:rgba(16,16,18,.8);color:#9a9aa2}
.chip b{color:#f2f2f2;font-weight:500}
.foot{position:absolute;left:58px;bottom:30px;font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#5e5e66}
</style></head><body>
<div class="glow"></div><div class="embers">${embers}</div>
<img class="mark" src="data:image/png;base64,${logo}">
<div class="top"><img src="data:image/png;base64,${logo}">ATOMIC</div>
<div class="eyebrow"><span class="dot"></span>token burn</div>
<div class="big">${n}</div>
<div class="unit">ATOMIC burned</div>
<div class="pct"><b>${pct}%</b> of total supply, gone for good</div>
<div class="row">
  <span class="chip">sent to <b>0x0000…dEaD</b></span>
  <span class="chip">tx <b>${tx.slice(0, 10)}…${tx.slice(-6)}</b></span>
  <span class="chip">supply <b>${Math.round(supply).toLocaleString("en-US")}</b></span>
</div>
<div class="foot">verifiable onchain</div>
</body></html>`;

const br = await chromium.launch({ channel: "chrome" });
const p = await br.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
await p.setContent(html); await p.waitForTimeout(2500);
await p.screenshot({ path: out });
await br.close();
console.log("rendered", out, n, pct + "%");
