import type { ReactNode } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Noise, Spotlight } from "@/components/ui/effects";
import { Eyebrow } from "@/components/ui/primitives";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex-1">
      <Spotlight />
      <Noise />
      <div className="relative z-[2]">
        <Nav />
        {children}
        <Footer />
      </div>
    </main>
  );
}

export function PageHero({ eyebrow, title, accent, lede, cta, watermark }: { eyebrow: string; title: string; accent: string; lede: string; cta?: { href: string; label: string }; watermark?: string }) {
  return (
    <section className="relative overflow-hidden border-b border-line pt-32 pb-16 md:pt-40 md:pb-20">
      <div className="aurora" />
      <div className="absolute inset-0 grid-bg" />
      {watermark && <div className="pointer-events-none absolute right-[-3%] top-[10%] hidden select-none font-display text-[20vw] italic leading-none outline-text lg:block">{watermark}</div>}
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="hero-h1 mt-6 max-w-4xl text-5xl leading-[0.98] tracking-[-0.03em] md:text-7xl">
          {title} <span className="font-display italic text-flash">{accent}</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">{lede}</p>
        {cta && (
          <Link href={cta.href} className="btn-flash mt-9 inline-flex rounded-full px-6 py-3 text-sm">
            {cta.label}
          </Link>
        )}
      </div>
    </section>
  );
}

export function SectionHead({ eyebrow, title, accent, children }: { eyebrow: string; title: string; accent?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-5 max-w-3xl text-3xl leading-[1.02] tracking-[-0.02em] md:text-5xl">
          {title}
          {accent && <span className="font-display italic text-muted"> {accent}</span>}
        </h2>
      </div>
      {children}
    </div>
  );
}
