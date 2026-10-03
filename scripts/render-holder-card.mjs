// Renders media/holder-perks.png (1200x675): what holding ATOMIC unlocks. Threshold is read from the router.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const min = process.argv[2] ?? "100,000";
const logo = readFileSync(new URL("../public/brand/atomic-sphere-alpha-1024.png", import.meta.url)).toString("base64");
const perks = [
  ["01", "Zero router fee", "Every perpetual, rotate and arbitrage runs without the 0.05% fee"],
  ["02", "Signals first", "Every price gap between pools, the moment it appears"],
  ["03", "Liquidation watch", "Positions about to be closed by force, with browser alerts"],
];
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:675px;background:#050505;color:#f2f2f2;font-family:'Bricolage Grotesque',system-ui,sans-serif;overflow:hidden;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 18% 40%,rgba(255,255,255,.10),transparent 50%),radial-gradient(ellipse at 95% 100%,rgba(255,255,255,.06),transparent 45%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.035) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 30% 40%,#000 15%,transparent 75%)}
.top{position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.2em;font-size:20px}.top img{width:46px;height:46px}
.eyebrow{position:absolute;left:58px;top:158px;font-family:'IBM Plex Mono',monospace;font-size:17px;letter-spacing:.26em;text-transform:uppercase;color:#c9c9d2;display:flex;align-items:center;gap:12px}
.dot{width:10px;height:10px;border-radius:99px;background:#fff;box-shadow:0 0 18px #fff}
.h{position:absolute;left:54px;top:196px;font-weight:800;font-size:96px;line-height:.98;letter-spacing:-.045em;width:540px}
.h span{display:block;color:#8e8e96}
.note{position:absolute;left:58px;bottom:78px;font-family:'IBM Plex Mono',monospace;font-size:15px;color:#9a9aa2;line-height:1.7}
.note b{color:#f2f2f2;font-weight:500}
.perks{position:absolute;right:56px;top:150px;width:520px;display:grid;gap:14px}
.perk{border:1px solid rgba(255,255,255,.16);border-radius:22px;background:linear-gradient(180deg,#131316,#0c0c0e);padding:22px 24px;display:grid;grid-template-columns:54px 1fr;gap:6px 10px;align-items:start}
.perk i{font-style:normal;font-family:'IBM Plex Mono',monospace;font-size:15px;color:#5e5e66;padding-top:6px}
.perk b{font-size:28px;letter-spacing:-.02em}
.perk p{grid-column:2;margin:0;font-family:Manrope,sans-serif;font-size:17px;line-height:1.45;color:#9a9aa2}
.foot{position:absolute;left:58px;bottom:30px;font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#5e5e66}
</style></head><body><div class="glow"></div><div class="grid"></div>
<div class="top"><img src="data:image/png;base64,${logo}">ATOMIC</div>
<div class="eyebrow"><span class="dot"></span>holder perks, live</div>
<div class="h">Hold ${min}<span>ATOMIC</span></div>
<div class="note">checked by the router itself, onchain<br><b>no staking, no lockup, no claim</b></div>
<div class="perks">${perks.map(([n, t, d]) => `<div class="perk"><i>${n}</i><b>${t}</b><p>${d}</p></div>`).join("")}</div>
<div class="foot">useatomic.xyz</div>
</body></html>`;
const br = await chromium.launch({ channel: "chrome" });
const p = await br.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
await p.setContent(html); await p.waitForTimeout(2500);
await p.screenshot({ path: "media/holder-perks.png" });
await br.close(); console.log("rendered media/holder-perks.png");
