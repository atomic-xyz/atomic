import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const bricolage = Bricolage_Grotesque({ variable: "--f-bricolage", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const manrope = Manrope({ variable: "--f-manrope", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--f-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

const fontVars = [bricolage, manrope, plexMono].map((f) => f.variable).join(" ");

const SITE_URL = "https://useatomic.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: "ATOMIC",
  description:
    "Borrow, swap, repay in one transaction. The execution layer for stock tokens on Robinhood Chain: leverage, collateral rotation and zero-capital arbitrage, settled inside a single block.",
  openGraph: {
    title: "ATOMIC",
    description: "Borrow, swap, repay in one transaction. Execution layer for stock tokens on Robinhood Chain",
    type: "website",
    url: SITE_URL,
    siteName: "ATOMIC",
  },
  twitter: { card: "summary_large_image", site: "@useatomic_xyz", creator: "@useatomic_xyz", title: "ATOMIC", description: "Borrow, swap, repay in one transaction" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontVars} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
