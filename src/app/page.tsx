import { Suspense } from "react";
import { ChipShowcase } from "@/components/ChipStack";
import { HomeClient } from "@/components/HomeClient";

/**
 * Felt & Clay landing — full-bleed felt atmosphere, brand-first hero,
 * clay chip visual. Lobby UI lives in HomeClient after auth.
 */
export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden">
      {/* Full-bleed felt plane */}
      <div
        aria-hidden
        className="hero-atmosphere pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 50% 35%, #2d5c42 0%, #1a3d2c 38%, #122018 68%, #0a100c 100%)",
        }}
      />
      {/* Soft lamp / candle wash */}
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute left-1/2 top-[-5%] h-[70vmax] w-[95vmax] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(232,184,74,0.22) 0%, rgba(140,106,74,0.08) 40%, transparent 65%)",
        }}
      />
      {/* Felt grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Oval table silhouette — edge-to-edge visual */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-8%] top-[6%] mx-auto h-[min(52vh,420px)] w-[116%] rounded-[50%] border-[10px] border-[#3a2818]/80 opacity-90 shadow-[inset_0_0_80px_rgba(0,0,0,0.55),0_20px_60px_rgba(0,0,0,0.4)] sm:top-[8%] sm:border-[14px]"
        style={{
          background:
            "radial-gradient(ellipse at center, #2d5c42 0%, #1a3d2c 45%, #0f2418 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[8%] top-[12%] mx-auto h-[min(40vh,300px)] w-[84%] rounded-[50%] border border-[rgba(232,184,74,0.12)]"
      />

      <div className="hero-copy relative z-10 flex flex-1 flex-col px-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:pt-8">
        <Suspense
          fallback={
            <div className="px-6 pt-24 text-[var(--fc-ink-mute)] sm:px-10">
              Carregando…
            </div>
          }
        >
          <HomeClient showcase={<ChipShowcase className="mt-2 mb-1" />} />
        </Suspense>
      </div>
    </main>
  );
}
