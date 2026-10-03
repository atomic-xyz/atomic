import { Suspense } from "react";
import { AppShell } from "@/components/app/AppShell";

export const metadata = { title: "ATOMIC / App" };

export default function AppPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <AppShell />
    </Suspense>
  );
}
