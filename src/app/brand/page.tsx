import type { Metadata } from "next";
import { MARKS } from "@/components/brand/Marks";

export const metadata: Metadata = { title: "ATOMIC / Brand", robots: { index: false } };

const TILES = [
  { name: "on black", bg: "#050505", fg: "#f2f2f2", accent: "#f2f2f2" },
  { name: "on white", bg: "#f2f2f2", fg: "#050505", accent: "#050505" },
  { name: "white tile", bg: "#f2f2f2", fg: "#050505", accent: "#050505" },
  { name: "mono", bg: "#111318", fg: "#ffffff", accent: "#8a94a6" },
];

export default function BrandPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Brand / mark options</div>
      <h1 className="mt-3 text-4xl">Four marks, one wordmark</h1>
      <p className="mt-3 max-w-2xl text-muted">Each mark is drawn from the product idea rather than decoration. Shown at 96, 48, 24 and 16 pixels, on four tiles, with the wordmark lockup and as an app icon.</p>

      <div className="mt-12 grid gap-10">
        {Object.values(MARKS).map((m, i) => (
          <section key={m.key} className="rounded-3xl border border-line bg-surface/60 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <span className="font-mono text-xs text-flash">0{i + 1}</span>
                <span className="ml-3 text-xl">{m.label}</span>
                <span className="ml-3 text-sm text-muted">{m.note}</span>
              </div>
              <span className="font-mono text-[11px] text-muted-2">{m.key}</span>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {TILES.map((t) => (
                <div key={t.name} className="rounded-2xl p-5" style={{ background: t.bg, color: t.fg }}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-60">{t.name}</div>
                  <div className="mt-4 flex items-end gap-5">
                    <m.Mark size={96} accent={t.accent} />
                    <m.Mark size={48} accent={t.accent} />
                    <m.Mark size={24} accent={t.accent} />
                    <m.Mark size={16} accent={t.accent} />
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <m.Mark size={30} accent={t.accent} />
                    <span className="text-[22px] font-bold tracking-[0.18em]" style={{ fontFamily: "var(--font-display)" }}>ATOMIC</span>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="grid h-14 w-14 place-items-center rounded-[16px]" style={{ background: t.fg, color: t.bg }}>
                      <m.Mark size={36} accent={t.accent === t.fg ? t.bg : t.accent} />
                    </span>
                    <span className="grid h-14 w-14 place-items-center rounded-[16px]" style={{ background: t.accent, color: t.bg === "#3df2b5" ? t.fg : "#04110d" }}>
                      <m.Mark size={36} accent={t.bg === "#3df2b5" ? t.fg : "#04110d"} />
                    </span>
                    <span className="font-mono text-[10px] opacity-60">app icon</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
