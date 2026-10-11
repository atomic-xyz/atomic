import Link from "next/link";
import { TokenAddress } from "@/components/ui/TokenAddress";

const PONS_URL = "https://ponsfamily.com";

/** One line under the hero: the token exists, here is its address, here is what holding it does. */
export function TokenBar() {
  return (
    <div className="border-y border-line bg-bg-2/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 md:px-8">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-2">
          <span className="h-1.5 w-1.5 rounded-full bg-up blink" /> ATOMIC token
        </span>
        <TokenAddress className="text-[13px] text-muted" />
        <span className="hidden text-sm text-muted sm:inline">Hold <b className="text-text">100,000 ATOMIC</b> and the router fee is zero</span>
        <span className="ml-auto flex items-center gap-2">
          <Link href="/app?tab=holders" className="btn-ghost rounded-full px-4 py-1.5 text-xs">Holder perks</Link>
          <a href={PONS_URL} target="_blank" rel="noreferrer" className="btn-flash rounded-full px-4 py-1.5 text-xs">Buy on Pons</a>
        </span>
      </div>
    </div>
  );
}
