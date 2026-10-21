import { Suspense } from "react";
import { HomeClient } from "@/components/HomeClient";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="hero-atmosphere pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_25%_15%,#3d5c2e_0%,transparent_45%),radial-gradient(ellipse_at_80%_0%,#5c3d1a_0%,transparent_40%),radial-gradient(ellipse_at_50%_100%,#1a2e1c_0%,#120c06_70%)]"
      />
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute -left-1/4 top-1/4 h-[60vmax] w-[60vmax] rounded-full bg-[radial-gradient(circle,rgba(240,180,41,0.14),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="hero-copy relative z-10 flex flex-1 flex-col justify-center gap-10 px-0 py-16 sm:py-24">
        <div className="px-6">
          <p className="mb-3 text-sm tracking-wide text-amber-200/60">
            ☕ Mesa da galera da igreja
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-amber-300 sm:text-7xl md:text-8xl">
            Poker Friends
          </h1>
          <p className="mt-5 max-w-md text-lg text-amber-50/70 sm:text-xl">
            Hold&apos;em com os irmãos. Entra com Google, cria a sala e chama a
            galera pelo código — sem julgamento (só all-in).
          </p>
        </div>

        <Suspense fallback={<div className="px-6 text-amber-100/40">Carregando…</div>}>
          <HomeClient />
        </Suspense>
      </div>

      <p className="relative z-10 px-6 pb-6 text-xs text-amber-200/30">
        A paz do Senhor · fichas na mesa · 🙏 opcional
      </p>
    </main>
  );
}
