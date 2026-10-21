import { Suspense } from "react";
import { ChipShowcase } from "@/components/ChipStack";
import { HomeClient } from "@/components/HomeClient";

export default function Home() {
  return (
    <main className="pf-shell pf-shell--landing">
      <Suspense
        fallback={
          <div className="pf-gate pf-gate--plain">
            <p className="pf-note">Carregando…</p>
          </div>
        }
      >
        <HomeClient showcase={<ChipShowcase />} />
      </Suspense>
    </main>
  );
}
