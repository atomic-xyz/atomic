"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { Logo } from "@/components/ui/primitives";
import { XLink } from "@/components/ui/XLink";
import { BlockClock } from "./BlockClock";

export const NAV_LINKS = [
  { href: "/actions", label: "Actions" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/markets", label: "Markets" },
  { href: "/risks", label: "Risks" },
];

export function Nav() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["rgba(var(--bg-rgb),0)", "rgba(var(--bg-rgb),0.82)"]);
  const border = useTransform(scrollY, [0, 80], ["rgba(var(--text-rgb),0)", "rgba(var(--text-rgb),0.08)"]);

  return (
    <motion.header style={{ background: bg, borderColor: border }} className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="ATOMIC home" className="shrink-0">
          <Logo />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          <ul className="flex items-center gap-0.5 rounded-full border border-line bg-surface/70 p-1 shadow-[0_8px_30px_-16px_rgba(var(--shadow-rgb),0.8)] backdrop-blur">
            {NAV_LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link href={l.href} className={`group relative block rounded-full px-4 py-2 text-[13.5px] font-medium tracking-[-0.005em] transition-colors ${active ? "text-[var(--on-flash)]" : "text-muted hover:text-text"}`}>
                    {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-full bg-flash shadow-[0_6px_18px_-8px_rgba(var(--flash-rgb),0.8)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    {!active && <span className="absolute inset-0 rounded-full bg-text/0 transition-colors group-hover:bg-text/6" />}
                    <span className="relative">{l.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2.5">
          <span className="hidden items-center rounded-full border border-line bg-surface/60 px-3 py-1.5 text-[11px] lg:inline-flex">
            <BlockClock />
          </span>
          <XLink className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/60 text-muted transition-colors hover:border-line-2 hover:text-text" />
          <Link href="/app" className="btn-flash inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            Launch app
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto px-4 pb-2.5 md:hidden">
        {NAV_LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${active ? "border-flash bg-flash text-[var(--on-flash)]" : "border-line text-muted"}`}>
              {l.label}
            </Link>
          );
        })}
      </div>
    </motion.header>
  );
}
