import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { TickerStrip } from "@/components/landing/TickerStrip";
import { Thesis } from "@/components/landing/Thesis";
import { Compare } from "@/components/landing/Compare";
import { Actions } from "@/components/landing/Actions";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Markets } from "@/components/landing/Markets";
import { Risks } from "@/components/landing/Risks";
import { Footer } from "@/components/landing/Footer";
import { Noise, Spotlight } from "@/components/ui/effects";

export default function Home() {
  return (
    <main className="relative flex-1">
      <Spotlight />
      <Noise />
      <div className="relative z-[2]">
        <Nav />
        <Hero />
        <TickerStrip />
        <Thesis />
        <Compare />
        <Actions />
        <HowItWorks />
        <Markets />
        <Risks />
        <Footer />
      </div>
    </main>
  );
}
