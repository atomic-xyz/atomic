/**
 * Draws a 1200x675 position card on a canvas, entirely in the browser, for sharing on X.
 * Nothing is uploaded: the caller turns the canvas into a blob and the user saves or copies it.
 */

export interface ShareCardData {
  symbol: string;
  /** leverage multiple, for example 2 for 2x */
  leverage: number;
  /** profit as a fraction of the wallet's own money, null when unknown */
  pnlPct: number | null;
  pnlUsd: number | null;
  /** value of the stock held, USD */
  collateralUsd: number;
  entryPrice: number | null;
  price: number | null;
  /** "mine" for the connected wallet's own position, "board" for a row from the Borrowers board */
  kind: "mine" | "board";
}

export const CARD_W = 1200;
export const CARD_H = 675;

const cssFont = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const usd = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `$${(a / 1e3).toFixed(1)}K` : `$${a.toLocaleString("en-US", { maximumFractionDigits: a < 100 ? 2 : 0 })}`;
  return n < 0 ? `-${s}` : s;
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function drawShareCard(canvas: HTMLCanvasElement, d: ShareCardData, opts: { hideAmounts: boolean }) {
  const scale = 2;
  canvas.width = CARD_W * scale;
  canvas.height = CARD_H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const display = cssFont("--f-bricolage", "system-ui, sans-serif");
  const mono = cssFont("--f-plex-mono", "ui-monospace, monospace");
  await Promise.all([
    document.fonts.load(`800 120px ${display}`).catch(() => undefined),
    document.fonts.load(`500 20px ${mono}`).catch(() => undefined),
  ]);
  const [logo, stock] = await Promise.all([loadImage("/brand/atomic-sphere-nav.png"), loadImage(`/logos/${d.symbol}.png`)]);

  const up = (d.pnlPct ?? 0) >= 0;
  const accent = d.pnlPct === null ? "#c9c9d2" : up ? "#6fd6a3" : "#f07070";
  const accentRgb = d.pnlPct === null ? "201,201,210" : up ? "111,214,163" : "240,112,112";

  // background
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(930, 190, 0, 930, 190, 620);
  glow.addColorStop(0, `rgba(${accentRgb},0.22)`);
  glow.addColorStop(1, `rgba(${accentRgb},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_H); ctx.stroke(); }
  for (let y = 0; y <= CARD_H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke(); }
  const fade = ctx.createLinearGradient(0, 0, 0, CARD_H);
  fade.addColorStop(0, "rgba(5,5,5,0)");
  fade.addColorStop(1, "rgba(5,5,5,0.85)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // brand
  if (logo) ctx.drawImage(logo, 54, 40, 52, 52);
  ctx.fillStyle = "#f2f2f2";
  ctx.font = `800 20px ${display}`;
  ctx.textBaseline = "middle";
  const brand = "ATOMIC";
  let bx = 118;
  for (const ch of brand) { ctx.fillText(ch, bx, 67); bx += ctx.measureText(ch).width + 4; }

  // stock tile + title
  const tileX = 58, tileY = 150, tile = 76;
  roundRect(ctx, tileX, tileY, tile, tile, 18);
  ctx.fillStyle = "#f4f4f6";
  ctx.fill();
  if (stock) {
    ctx.save();
    roundRect(ctx, tileX, tileY, tile, tile, 18);
    ctx.clip();
    ctx.drawImage(stock, tileX + 10, tileY + 10, tile - 20, tile - 20);
    ctx.restore();
  } else {
    ctx.fillStyle = "#050505";
    ctx.font = `800 22px ${display}`;
    ctx.textAlign = "center";
    ctx.fillText(d.symbol.slice(0, 4), tileX + tile / 2, tileY + tile / 2);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "#f2f2f2";
  ctx.font = `800 50px ${display}`;
  ctx.fillText(d.symbol, tileX + tile + 22, tileY + 26);
  ctx.fillStyle = "#9a9aa2";
  ctx.font = `500 19px ${mono}`;
  ctx.fillText(`${d.leverage.toFixed(2)}x long, no expiry`, tileX + tile + 24, tileY + 62);

  // headline number
  ctx.textBaseline = "alphabetic";
  const pct = d.pnlPct === null ? "open" : `${up ? "+" : ""}${(d.pnlPct * 100).toFixed(1)}%`;
  ctx.fillStyle = accent;
  ctx.font = `800 ${pct.length > 7 ? 150 : 178}px ${display}`;
  ctx.fillText(pct, 50, 430);
  ctx.fillStyle = "#c9c9d2";
  ctx.font = `700 30px ${display}`;
  ctx.fillText(d.pnlPct === null ? "position is live" : d.kind === "mine" ? "on my own money" : "on this wallet's own money", 58, 478);

  // detail chips
  const chips: [string, string][] = [];
  if (!opts.hideAmounts) {
    if (d.pnlUsd !== null) chips.push(["profit", `${d.pnlUsd >= 0 ? "+" : ""}${usd(d.pnlUsd)}`]);
    chips.push(["position", usd(d.collateralUsd)]);
  }
  if (d.entryPrice && d.price) chips.push(["entry to now", `${usd(d.entryPrice)} to ${usd(d.price)}`]);
  chips.push(["leverage", `${d.leverage.toFixed(2)}x`]);
  let cx = 56;
  ctx.textBaseline = "middle";
  for (const [k, v] of chips) {
    ctx.font = `400 17px ${mono}`;
    const wk = ctx.measureText(k).width;
    ctx.font = `600 17px ${mono}`;
    const wv = ctx.measureText(v).width;
    const w = wk + wv + 46;
    roundRect(ctx, cx, 540, w, 46, 23);
    ctx.fillStyle = "rgba(16,16,18,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.stroke();
    ctx.fillStyle = "#9a9aa2";
    ctx.font = `400 17px ${mono}`;
    ctx.fillText(k, cx + 18, 564);
    ctx.fillStyle = "#f2f2f2";
    ctx.font = `600 17px ${mono}`;
    ctx.fillText(v, cx + 18 + wk + 10, 564);
    cx += w + 10;
  }

  // footer
  ctx.fillStyle = "#5e5e66";
  ctx.font = `500 15px ${mono}`;
  ctx.fillText("USEATOMIC.XYZ", 58, 632);
  ctx.textAlign = "right";
  ctx.fillText(d.kind === "mine" ? "ONE TRANSACTION TO OPEN" : "FROM THE LIVE BORROWERS BOARD", CARD_W - 58, 632);
  ctx.textAlign = "left";

  // large faded logo on the right
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(logo, 760, 150, 400, 400);
    ctx.restore();
  }
}

export function shareText(d: ShareCardData) {
  const pct = d.pnlPct === null ? "" : `${d.pnlPct >= 0 ? "+" : ""}${(d.pnlPct * 100).toFixed(1)}% `;
  return d.kind === "mine"
    ? `${pct}on ${d.symbol} at ${d.leverage.toFixed(1)}x, opened in one transaction on @useatomic_xyz`
    : `A ${d.leverage.toFixed(1)}x ${d.symbol} position, ${pct}and counting. Live on the @useatomic_xyz board`;
}
