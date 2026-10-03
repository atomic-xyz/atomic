"use client";

import { useEffect, useRef } from "react";

interface Block { x: number; y: number; w: number; h: number; speed: number; depth: number; lit: number; segs: number[] }

/**
 * Full-bleed canvas: lanes of blocks stream past at different depths, standing in for the
 * 100ms block cadence. Every so often one block lights up and its five segments fill in order:
 * the atomic transaction landing inside a single block.
 */
export function HeroCanvas({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0, h = 0, dpr = 1;
    const lanes = 7;
    let blocks: Block[] = [];

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      blocks = [];
      for (let l = 0; l < lanes; l++) {
        const depth = 0.35 + (l / (lanes - 1)) * 0.65;
        const count = Math.ceil(w / (150 * depth)) + 2;
        for (let i = 0; i < count; i++) {
          blocks.push({
            x: (i / count) * (w + 300) - 150,
            y: 40 + (l / (lanes - 1)) * (h - 80) + (Math.random() - 0.5) * 20,
            w: 70 + Math.random() * 60 * depth,
            h: 22 + 26 * depth,
            speed: (18 + 40 * depth) * (0.8 + Math.random() * 0.4),
            depth,
            lit: 0,
            segs: [0, 0, 0, 0, 0],
          });
        }
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let last = performance.now();
    let litTimer = 0;
    let visible = true;
    let flashRgb = "217,255,61", textRgb = "238,240,244", frame = 0;
    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      flashRgb = cs.getPropertyValue("--flash-rgb").trim() || flashRgb;
      textRgb = cs.getPropertyValue("--text-rgb").trim() || textRgb;
    };
    readTheme();
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { last = performance.now(); raf = requestAnimationFrame(draw); }
    });
    io.observe(canvas);
    const draw = (now: number) => {
      if (!visible) return;
      if (++frame % 60 === 0) readTheme();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, w, h);
      const px = (mouse.current.x - 0.5) * 30;
      const py = (mouse.current.y - 0.5) * 16;

      litTimer += dt;
      if (litTimer > 2.6) {
        litTimer = 0;
        const candidates = blocks.filter((b) => b.depth > 0.7 && b.x > w * 0.15 && b.x < w * 0.6 && b.lit <= 0);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        if (pick) { pick.lit = 0.001; pick.segs = [0, 0, 0, 0, 0]; }
      }

      for (const b of blocks) {
        if (!reduce) b.x -= b.speed * dt;
        if (b.x + b.w < -40) { b.x = w + 40 + Math.random() * 120; b.lit = 0; b.segs = [0, 0, 0, 0, 0]; }
        const ox = b.x + px * b.depth;
        const oy = b.y + py * b.depth;
        const alpha = 0.05 + b.depth * 0.12;

        if (b.lit > 0) {
          b.lit += dt;
          const t = b.lit;
          for (let s = 0; s < 5; s++) b.segs[s] = Math.max(0, Math.min(1, (t - s * 0.32) / 0.28));
          const done = b.segs[4] >= 1;
          const glow = done ? Math.max(0, 1 - (t - 1.9) / 1.6) : 1;
          if (t > 3.6) b.lit = 0;
          // glow halo
          const g = ctx.createRadialGradient(ox + b.w / 2, oy + b.h / 2, 0, ox + b.w / 2, oy + b.h / 2, b.w);
          g.addColorStop(0, `rgba(${flashRgb},${0.28 * glow})`);
          g.addColorStop(1, `rgba(${flashRgb},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(ox - b.w / 2, oy - b.w / 2, b.w * 2, b.w + b.h);
          // frame
          ctx.strokeStyle = `rgba(${flashRgb},${0.6 * glow + 0.2})`;
          ctx.lineWidth = 1;
          roundRect(ctx, ox, oy, b.w, b.h, 6);
          ctx.stroke();
          // segments
          const pad = 6, gap = 3;
          const sw = (b.w - pad * 2 - gap * 4) / 5;
          for (let s = 0; s < 5; s++) {
            const f = b.segs[s];
            ctx.fillStyle = `rgba(${flashRgb},${0.12 + 0.75 * f * (done ? glow : 1)})`;
            roundRect(ctx, ox + pad + s * (sw + gap), oy + pad, sw * Math.max(f, 0.08), b.h - pad * 2, 2);
            ctx.fill();
          }
          if (done && glow > 0.2) {
            ctx.fillStyle = `rgba(${flashRgb},${glow})`;
            ctx.font = "600 9px ui-monospace, monospace";
            ctx.fillText("1 TX", ox + b.w + 8, oy + b.h / 2 + 3);
          }
        } else {
          ctx.strokeStyle = `rgba(${textRgb},${alpha})`;
          ctx.lineWidth = 1;
          roundRect(ctx, ox, oy, b.w, b.h, 6);
          ctx.stroke();
          ctx.fillStyle = `rgba(${textRgb},${alpha * 0.45})`;
          const pad = 6;
          const n = 3 + Math.round(b.depth * 3);
          const bw = (b.w - pad * 2) / n - 2;
          for (let s = 0; s < n; s++) {
            const hh = (b.h - pad * 2) * (0.35 + ((s * 37 + b.w) % 10) / 16);
            roundRect(ctx, ox + pad + s * (bw + 2), oy + b.h - pad - hh, bw, hh, 1.5);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener("pointermove", onMove); };
  }, []);

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden />;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
