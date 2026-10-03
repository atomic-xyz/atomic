import Link from "next/link";
import { XIcon, X_URL } from "@/components/ui/XLink";
import { Logo } from "@/components/ui/primitives";
import { ADDR, EXPLORER } from "@/lib/addresses";
import { DATA_META } from "@/lib/data";

export function Footer() {
  return (
    <footer className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-8">
        <div className="beam-border relative rounded-[32px] p-10 md:p-16">
          <div className="absolute inset-0 grid-bg opacity-60" />
          <div className="pointer-events-none absolute -bottom-40 left-1/2 h-[520px] w-[1000px] -translate-x-1/2 [background:radial-gradient(closest-side,rgba(var(--flash-rgb),0.16),transparent_70%)]" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div>
              <h2 className="text-4xl leading-[1.02] tracking-[-0.02em] md:text-6xl">
                One signature.
                <br />
                <span className="font-display italic text-flash">Before the next block</span>
              </h2>
              <p className="mt-5 max-w-md text-muted">Quotes, health factors and spreads are live now. Mainnet execution opens when the router is verified.</p>
            </div>
            <Link href="/app" className="btn-flash rounded-full px-7 py-3.5 text-sm">
              Open the app
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-10 border-t border-line pt-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">Execution layer for stock tokens on Robinhood Chain. Borrow, swap, repay in one transaction.</p>
          </div>
          <div className="text-sm">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">Product</div>
            <ul className="mt-4 space-y-2 text-muted">
              <li><Link href="/actions" className="hover:text-text">Actions</Link></li>
              <li><Link href="/how-it-works" className="hover:text-text">How it works</Link></li>
              <li><Link href="/markets" className="hover:text-text">Markets</Link></li>
              <li><Link href="/risks" className="hover:text-text">Risks</Link></li>
              <li><Link href="/app" className="hover:text-text">App</Link></li>
              <li><a href={X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-text"><XIcon size={13} /> @useatomic_xyz</a></li>
              <li><a href="https://github.com/atomic-xyz/atomic" target="_blank" rel="noreferrer" className="hover:text-text">GitHub, open source</a></li>
            </ul>
          </div>
          <div className="text-sm">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">Built on</div>
            <ul className="mt-4 space-y-2 text-muted">
              <li><a href={`${EXPLORER}/address/${ADDR.MORPHO}`} target="_blank" rel="noreferrer" className="hover:text-text">Morpho</a></li>
              <li><a href={`${EXPLORER}/address/${ADDR.UNI_V3_FACTORY}`} target="_blank" rel="noreferrer" className="hover:text-text">Uniswap v3</a></li>
              <li><a href={`${EXPLORER}/address/${ADDR.UNI_V4_POOL_MANAGER}`} target="_blank" rel="noreferrer" className="hover:text-text">Uniswap v4</a></li>
              <li><a href={`${EXPLORER}/address/${ADDR.STOCK_FACTORY}`} target="_blank" rel="noreferrer" className="hover:text-text">Stock token factory</a></li>
            </ul>
          </div>
          <div className="text-sm">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-2">Network</div>
            <ul className="mt-4 space-y-2 font-mono text-xs text-muted">
              <li>Robinhood Chain</li>
              <li>gas in ETH</li>
              <li>data refreshed {new Date(DATA_META.generatedAt).toISOString().slice(0, 10)}</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-muted-2">
          <span>ATOMIC is not affiliated with Robinhood Markets, Morpho Labs or Uniswap Labs.</span>
          <span>Not available to persons restricted from holding stock tokens.</span>
        </div>
      </div>
    </footer>
  );
}
