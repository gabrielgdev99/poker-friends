import { Suspense } from "react";
import { HomeClient } from "@/components/HomeClient";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="hero-atmosphere pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 80% at 50% 40%, #2a5234 0%, #152818 50%, #0c0a06 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-10%] top-[8%] mx-auto h-[min(58vh,480px)] w-[120%] max-w-none rounded-[50%] border-[14px] border-[#3d2914]/70 bg-[radial-gradient(ellipse_at_center,#2a6b3e_0%,#1a4530_50%,#0f2418_100%)] opacity-95 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"
      />
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute left-1/2 top-[5%] h-[55vmax] w-[80vmax] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(240,180,41,0.18),transparent_62%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="hero-copy relative z-10 flex flex-1 flex-col justify-end gap-6 px-0 pb-8 pt-16 sm:justify-center sm:gap-8 sm:pb-14 sm:pt-20">
        <div className="px-6 sm:px-10">
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(3.5rem,14vw,7rem)] leading-[0.88] tracking-tight text-amber-300">
            Poker Friends
          </h1>
          <p className="mt-3 max-w-sm text-base text-amber-50/75 sm:mt-4 sm:text-lg">
            Hold&apos;em com a galera da igreja. Mesa quente, sem julgamento.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="px-6 text-amber-100/40 sm:px-10">Carregando…</div>
          }
        >
          <HomeClient />
        </Suspense>
      </div>
    </main>
  );
}
