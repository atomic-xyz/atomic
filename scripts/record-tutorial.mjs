// Records a captioned walkthrough of the live ATOMIC site. No wallet is connected and nothing is signed.
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";

const BASE = process.env.BASE ?? "https://useatomic.xyz";
const W = 1280, H = 720;
const OUT = "tutorial-raw";
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT);

const overlay = () => {
  // Caption bar, step chip and a visible cursor. Runs on every page load; the recorder does not draw the real cursor.
  const make = () => {
    if (document.getElementById("__cap")) return;
    const style = document.createElement("style");
    style.textContent = `
      #__cap{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483646;max-width:980px;padding:14px 26px;border-radius:18px;
        background:rgba(10,10,12,.88);border:1px solid rgba(255,255,255,.18);color:#fff;font:600 22px/1.35 system-ui,Segoe UI,Arial;text-align:center;
        box-shadow:0 20px 60px rgba(0,0,0,.6);backdrop-filter:blur(8px);opacity:0;transition:opacity .35s ease, transform .35s ease;pointer-events:none}
      #__cap.on{opacity:1}
      #__cap small{display:block;font:600 12px/1 ui-monospace,Consolas,monospace;letter-spacing:.22em;text-transform:uppercase;color:#a9a9b3;margin-bottom:8px}
      #__cur{position:fixed;left:0;top:0;width:22px;height:22px;margin:-4px 0 0 -4px;z-index:2147483647;pointer-events:none;transition:transform .08s linear}
      #__ring{position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:999px;border:2px solid #fff;z-index:2147483645;pointer-events:none;opacity:0}
      #__ring.go{animation:__ring .5s ease-out}
      @keyframes __ring{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(1.5)}}
      #__end{position:fixed;inset:0;z-index:2147483646;background:#050505;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;opacity:0;transition:opacity .6s ease;pointer-events:none}
      #__end.on{opacity:1}
      #__end img{width:220px;height:220px}
      #__end b{font:800 54px/1 system-ui,Segoe UI,Arial;letter-spacing:.14em;color:#fff}
      #__end span{font:600 26px/1 ui-monospace,Consolas,monospace;color:#c9c9d2}
    `;
    document.documentElement.appendChild(style);
    const cap = document.createElement("div"); cap.id = "__cap"; document.documentElement.appendChild(cap);
    const cur = document.createElement("div"); cur.id = "__cur";
    cur.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cur);
    const ring = document.createElement("div"); ring.id = "__ring"; document.documentElement.appendChild(ring);
    const end = document.createElement("div"); end.id = "__end";
    end.innerHTML = '<img src="/brand/atomic-sphere-alpha-1024.png" alt=""><b>ATOMIC</b><span>useatomic.xyz</span>';
    document.documentElement.appendChild(end);
    const pos = JSON.parse(sessionStorage.getItem("__curpos") || "[640,360]");
    cur.style.transform = `translate(${pos[0]}px,${pos[1]}px)`;
    window.addEventListener("mousemove", (e) => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; sessionStorage.setItem("__curpos", JSON.stringify([e.clientX, e.clientY])); }, true);
    window.addEventListener("mousedown", (e) => { ring.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; ring.classList.remove("go"); void ring.offsetWidth; ring.classList.add("go"); }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", make); else make();
};

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } }, deviceScaleFactor: 1 });
await ctx.addInitScript(overlay);
const page = await ctx.newPage();
const sleep = (ms) => page.waitForTimeout(ms);

async function go(path) {
  for (let a = 0; a < 3; a++) { try { await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 }); return; } catch (e) { if (a === 2) throw e; } }
}
async function caption(step, text, hold = 2600) {
  await page.evaluate(([s, t]) => { const c = document.getElementById("__cap"); if (!c) return; c.innerHTML = (s ? `<small>${s}</small>` : "") + t; c.classList.add("on"); }, [step, text]);
  await sleep(hold);
}
async function hideCaption() { await page.evaluate(() => document.getElementById("__cap")?.classList.remove("on")); await sleep(250); }
let mx = 640, my = 360;
async function moveTo(x, y, steps = 28) { await page.mouse.move(x, y, { steps }); mx = x; my = y; await sleep(180); }
async function target(locator) {
  await locator.first().scrollIntoViewIfNeeded().catch(() => {});
  await sleep(350);
  const b = await locator.first().boundingBox();
  if (!b) throw new Error("no box for locator");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function click(locator, after = 900) { const p = await target(locator); await moveTo(p.x, p.y); await page.mouse.down(); await sleep(70); await page.mouse.up(); await sleep(after); }
async function hover(locator, after = 700) { const p = await target(locator); await moveTo(p.x, p.y); await sleep(after); }
async function scrollBy(dy, ms = 900) { await page.evaluate(([d, t]) => window.scrollBy({ top: d, behavior: "smooth" }), [dy, ms]); await sleep(ms); }

// ---------- 1. landing ----------
await go("/");
await sleep(2200);
await caption("ATOMIC", "Leverage and arbitrage for tokenized stocks, in one transaction", 3200);
await scrollBy(520, 1100);
await caption("ATOMIC", "It borrows, buys and repays inside a single transaction. If one step fails, nothing happens", 3400);
await scrollBy(-520, 900);
await hideCaption();
await click(page.locator('a[href="/app"]', { hasText: "Launch app" }), 600);
await page.waitForSelector("header nav button", { timeout: 60000 });
await sleep(2200);

// ---------- 2. perpetual ----------
await caption("Perpetual", "Start here: buy a stock with more than you have, with no expiry", 3000);
await caption("Step 1", "Pick the stock you want", 1500);
await click(page.locator("section button", { hasText: /^TSLA$/ }), 900);
await click(page.locator("section button", { hasText: /^NVDA$/ }), 900);
await caption("Step 2", "Type how much of your own money goes in", 1400);
const amount = page.locator('input[inputmode="decimal"]');
await click(amount, 300);
await page.keyboard.press("Control+A");
await page.keyboard.type("500", { delay: 160 });
await sleep(1200);
await scrollBy(300, 800);
await caption("Step 3", "Choose how bold. Each card tells you what you control and when it closes", 2200);
await click(page.locator("section button", { hasText: "Careful" }), 1300);
await click(page.locator("section button", { hasText: "Bold" }), 1300);
await click(page.locator("section button", { hasText: "Balanced" }), 1100);
await scrollBy(330, 900);
await caption("Review", "One sentence sums it up: what you buy, what you owe, and the price that closes it", 3600);
await hover(page.getByText("Connect a wallet on Robinhood Chain to sign").first(), 500).catch(() => {});
await caption("Buy", "Connect your wallet, press Buy, and confirm. Approve, allow, open: three quick signatures the first time", 4000);
await click(page.getByRole("button", { name: /Show details/ }), 1200);
await scrollBy(420, 1000);
await caption("Details", "Open the details to fine-tune the leverage and see what your money becomes if the price moves", 3600);
await scrollBy(520, 1100);
await caption("Details", "The chart shows your money across prices. The shaded zone is where the position is closed", 3400);
await hideCaption();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(1100);

// ---------- 3. arbitrage ----------
await click(page.locator("header nav button", { hasText: "Arbitrage" }), 2600);
await caption("Arbitrage", "The same stock trades in several pools. This tab finds the price gaps between them", 3200);
await scrollBy(430, 1000);
await caption("Arbitrage", "Green means the gap pays after fees. Take it with zero capital: the money is borrowed and repaid in the same transaction", 4200);
await hideCaption();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(1000);

// ---------- 4. borrowers ----------
await click(page.locator("header nav button", { hasText: "Borrowers" }), 3200);
await caption("Borrowers", "Every leveraged stock position on-chain, with live profit", 3000);
await scrollBy(300, 900);
await caption("Borrowers", "See what each wallet holds, what it owes, and how far it is from liquidation", 3400);
await click(page.locator("button", { hasText: /^SPY/ }).first(), 1600).catch(() => {});
await hideCaption();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(1000);

// ---------- 5. my positions ----------
await click(page.locator("header nav button", { hasText: "My positions" }), 2400);
await caption("My positions", "After you buy, your position shows up here with live profit and a one-click close", 3800);
await hideCaption();

// ---------- 6. holders ----------
await click(page.locator("header nav button", { hasText: "Holders" }), 2600);
await caption("Holders", "Hold the ATOMIC token to pay zero router fee and see every signal first", 3600);
await hideCaption();

// ---------- 7. end card ----------
await page.evaluate(() => document.getElementById("__end")?.classList.add("on"));
await sleep(3000);

const video = page.video();
await ctx.close();
await browser.close();
const file = readdirSync(OUT).find((f) => f.endsWith(".webm"));
renameSync(`${OUT}/${file}`, "tutorial.webm");
console.log("recorded tutorial.webm", video ? "ok" : "");
