// Renders media/open-source.png (1200x675): the "ATOMIC is open source" announcement card.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const logo = readFileSync(new URL("../public/brand/atomic-sphere-alpha-1024.png", import.meta.url)).toString("base64");
const k = (s) => `<span class="k">${s}</span>`, f = (s) => `<span class="f">${s}</span>`, c = (s) => `<span class="c">${s}</span>`, n = (s) => `<span class="n">${s}</span>`;
const code = [
  c("// one callback, one context"),
  `${k("function")} ${f("openLeverage")}(`,
  `    MarketParams ${k("calldata")} market,`,
  `    ${k("uint256")} deposit,`,
  `    ${k("uint256")} flashAmount,`,
  `    ${k("bytes calldata")} path,`,
  `    ${k("uint256")} minCollateralOut`,
  `) ${k("external")} nonReentrant {`,
  `    ${f("_checkPath")}(path, USDG, market.collateralToken);`,
  `    ${f("_run")}(Action.Leverage, flashAmount, data);`,
  `}`,
  ``,
  c("// holders pay nothing"),
  `${k("if")} (bal >= holderMin) ${k("return")} ${n("0")};`,
].map((l, i) => `<div class="ln"><i>${String(i + 1).padStart(2, " ")}</i>${l || "&nbsp;"}</div>`).join("");

const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:675px;background:#050505;color:#f2f2f2;font-family:'Bricolage Grotesque',system-ui,sans-serif;overflow:hidden;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 12% 30%,rgba(255,255,255,.10),transparent 50%),radial-gradient(ellipse at 100% 100%,rgba(255,255,255,.07),transparent 45%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.035) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 25% 40%,#000 15%,transparent 75%)}
.top{position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.2em;font-size:20px}.top img{width:46px;height:46px}
.eyebrow{position:absolute;left:58px;top:164px;font-family:'IBM Plex Mono',monospace;font-size:17px;letter-spacing:.26em;text-transform:uppercase;color:#c9c9d2;display:flex;align-items:center;gap:12px}
.dot{width:10px;height:10px;border-radius:99px;background:#fff;box-shadow:0 0 18px #fff}
.h{position:absolute;left:54px;top:200px;font-weight:800;font-size:104px;line-height:.96;letter-spacing:-.045em}
.h span{display:block;color:#8e8e96}
.chips{position:absolute;left:56px;top:442px;display:flex;flex-wrap:wrap;gap:10px;width:520px;font-family:'IBM Plex Mono',monospace;font-size:16px}
.chip{border:1px solid rgba(255,255,255,.16);border-radius:99px;padding:9px 16px;background:rgba(16,16,18,.8);color:#9a9aa2}.chip b{color:#f2f2f2;font-weight:500}
.url{position:absolute;left:58px;bottom:44px;font-family:'IBM Plex Mono',monospace;font-size:22px;color:#f2f2f2}
.url span{color:#5e5e66}
.win{position:absolute;right:48px;top:118px;width:560px;border:1px solid rgba(255,255,255,.16);border-radius:20px;background:linear-gradient(180deg,#121214,#0a0a0b);box-shadow:0 40px 100px -40px #000;overflow:hidden;transform:perspective(1400px) rotateY(-7deg) rotateX(2deg)}
.bar{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.1);font-family:'IBM Plex Mono',monospace;font-size:13px;color:#5e5e66}
.bar u{width:11px;height:11px;border-radius:99px;background:#2b2b30;display:block;text-decoration:none}
.bar b{margin-left:10px;font-weight:400;color:#9a9aa2}
.code{padding:18px 20px 22px;font-family:'IBM Plex Mono',monospace;font-size:15px;line-height:1.78;color:#c9c9d2;white-space:pre}
.ln i{font-style:normal;color:#3b3b42;margin-right:16px}
.k{color:#f2f2f2;font-weight:600}.f{color:#fff;border-bottom:1px solid rgba(255,255,255,.35)}.c{color:#5e5e66}.n{color:#6fd6a3;font-weight:600}
</style></head><body><div class="glow"></div><div class="grid"></div>
<div class="top"><img src="data:image/png;base64,${logo}">ATOMIC</div>
<div class="eyebrow"><span class="dot"></span>as of today</div>
<div class="h">Open<span>source</span></div>
<div class="chips">
  <span class="chip"><b>400</b> lines of Solidity</span>
  <span class="chip"><b>23</b> tests on the live chain</span>
  <span class="chip">no proxy</span><span class="chip">no custody</span><span class="chip"><b>MIT</b></span>
</div>
<div class="url"><span>github.com/</span>atomic-xyz/atomic</div>
<div class="win"><div class="bar"><u></u><u></u><u></u><b>contracts/src/AtomicRouter.sol</b></div><div class="code">${code}</div></div>
</body></html>`;

const br = await chromium.launch({ channel: "chrome" });
const p = await br.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
await p.setContent(html); await p.waitForTimeout(2500);
await p.screenshot({ path: "media/open-source.png" });
await br.close(); console.log("rendered media/open-source.png");
