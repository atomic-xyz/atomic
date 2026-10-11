// Renders the "token is live" card for X: node scripts/render-ca-card.mjs <contract address> <out.png> [burned %]
import { chromium } from "playwright";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const [ca, out, burned = "2.8"] = process.argv.slice(2);
if (!ca || !out) { console.error("usage: node scripts/render-ca-card.mjs <contract address> <out.png> [burned %]"); process.exit(1); }
const root = process.env.ATOMIC_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mark = "data:image/png;base64," + readFileSync(path.join(root, "public/brand/atomic-sphere-alpha-1024.png")).toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{margin:0;width:1200px;height:675px;background:#050505;color:#f2f2f2;font-family:'Bricolage Grotesque',system-ui,sans-serif;overflow:hidden;position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(242,242,242,.04) 1px,transparent 1px),linear-gradient(to bottom,rgba(242,242,242,.04) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse at 30% 50%,#000 20%,transparent 80%);-webkit-mask-image:radial-gradient(ellipse at 30% 50%,#000 20%,transparent 80%)}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 84% 40%,rgba(255,138,61,.30),transparent 46%),radial-gradient(ellipse at 6% 0%,rgba(255,255,255,.06),transparent 45%)}
.mark{position:absolute;right:-70px;top:-40px;width:520px;height:520px;opacity:.55;filter:drop-shadow(0 0 60px rgba(255,150,70,.45));mask-image:linear-gradient(to top,transparent 8%,#000 60%);-webkit-mask-image:linear-gradient(to top,transparent 8%,#000 60%)}
.top{position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.22em;font-size:20px}
.top img{width:30px;height:30px}
.tag{position:absolute;right:56px;top:46px;font-family:'IBM Plex Mono',monospace;font-size:15px;letter-spacing:.2em;color:#9b9ba6}
.eyebrow{position:absolute;left:58px;top:150px;font-family:'IBM Plex Mono',monospace;font-size:17px;letter-spacing:.26em;text-transform:uppercase;color:#ff9a57;display:flex;align-items:center;gap:12px}
.dot{width:10px;height:10px;border-radius:99px;background:#ff9a57;box-shadow:0 0 18px #ff9a57}
.big{position:absolute;left:52px;top:184px;font-weight:800;font-size:118px;line-height:1;letter-spacing:-.045em}
.ca{position:absolute;left:56px;right:56px;top:330px;font-family:'IBM Plex Mono',monospace;font-size:36px;letter-spacing:.01em;background:#0b0b0b;border:1px solid rgba(242,242,242,.2);border-radius:16px;padding:22px 26px;white-space:nowrap;z-index:2}
.ca .l{display:block;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#9b9ba6;margin-bottom:8px}
.perk{position:absolute;left:58px;top:468px;font-size:28px;color:#c9c9d2}
.perk b{color:#f2f2f2;font-weight:800}
.perk2{top:510px}
.foot{position:absolute;left:58px;bottom:44px;font-family:'IBM Plex Mono',monospace;font-size:15px;letter-spacing:.14em;color:#9b9ba6}
.foot i{font-style:normal;color:#ff9a57}
</style></head><body>
<div class="grid"></div><div class="glow"></div>
<img class="mark" src="${mark}">
<div class="top"><img src="${mark}">ATOMIC</div>
<div class="tag">useatomic.xyz</div>
<div class="eyebrow"><span class="dot"></span>Contract address</div>
<div class="big">Token is live</div>
<div class="ca"><span class="l">CA</span>${ca}</div>
<div class="perk">Hold <b>100,000 ATOMIC</b> and the router fee is <b>zero</b></div>
<div class="perk perk2"><b>${burned}%</b> of supply burned</div>
<div class="foot">BUY ON <i>PONSFAMILY.COM</i> · USE IT ON <i>USEATOMIC.XYZ</i></div>
</body></html>`;

const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
await p.setContent(html, { waitUntil: "load" });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(600);
await p.screenshot({ path: out });
await b.close();
console.log("wrote", out);
