import { Suspense } from "react";
import { ChipShowcase } from "@/components/ChipStack";
import { HomeClient } from "@/components/HomeClient";

export default function Home() {
  return (
    <main className="home-shell">
      <Suspense
        fallback={
          <div className="home-screen">
            <div className="home-felt">
              <div className="home-oval">
                <p className="home-center home-kicker">Carregando…</p>
              </div>
            </div>
          </div>
        }
      >
        <HomeClient showcase={<ChipShowcase />} />
      </Suspense>
    </main>
  );
}
