import { Suspense } from "react";
import { HomeClient } from "@/components/HomeClient";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Full-bleed atmospheric felt — brand surface, not a card collage */}
      <div
        aria-hidden
        className="hero-atmosphere pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 35%, #2f5c38 0%, #1a3524 42%, #120c06 78%), linear-gradient(165deg, #3a2810 0%, transparent 40%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[18%] mx-auto h-[min(52vw,420px)] w-[min(92vw,720px)] rounded-[50%] border-[12px] border-[#4a3218]/80 bg-[radial-gradient(ellipse_at_center,#2a6b3e_0%,#1a4530_45%,#0f2418_100%)] opacity-90 shadow-[inset_0_0_80px_rgba(0,0,0,0.45)]"
      />
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute left-1/2 top-[12%] h-[50vmax] w-[70vmax] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(240,180,41,0.16),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="hero-copy relative z-10 flex flex-1 flex-col justify-end gap-8 px-0 pb-10 pt-20 sm:justify-center sm:pb-16 sm:pt-24">
        <div className="px-6 sm:px-10">
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(3.25rem,12vw,6.5rem)] leading-[0.9] tracking-tight text-amber-300">
            Poker Friends
          </h1>
          <p className="mt-4 max-w-md text-base text-amber-50/75 sm:text-lg">
            Hold&apos;em com a galera da igreja — mesa quente, fichas na mão, sem
            julgamento (só all-in).
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

      <p className="relative z-10 px-6 pb-5 text-xs text-amber-200/35 sm:px-10">
        A paz do Senhor · fichas na mesa · 🙏 opcional
      </p>
    </main>
  );
}
