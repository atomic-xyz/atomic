import type { Metadata } from "next";
import { PageHero, PageShell } from "@/components/site/PageShell";
import { ActionsDetail } from "@/components/pages/ActionsDetail";

export const metadata: Metadata = { title: "ATOMIC / Actions", description: "Leverage, rotate and arb stock tokens on Robinhood Chain, each in one transaction." };

export default function ActionsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Actions"
        title="Three things you can do"
        accent="in one signature"
        lede="Each action is a fixed recipe of contract calls that runs inside a single flash-loan callback. Below: what every step does, which contracts it touches, the live numbers behind it and the guardrails that make it revert instead of half-succeed."
        cta={{ href: "/app", label: "Open the app" }}
        watermark="act"
      />
      <ActionsDetail />
    </PageShell>
  );
}
