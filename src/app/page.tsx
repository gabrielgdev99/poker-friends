import { Suspense } from "react";
import { ChipShowcase } from "@/components/ChipStack";
import { HomeClient } from "@/components/HomeClient";

/**
 * Felt & Clay landing — felt fills 100dvh (no black band).
 * Brand-first hero; lobby after auth in HomeClient.
 */
export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip bg-[#163528]">
      {/* Full-viewport felt — fixed so it never cuts to body black */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 110% 70% at 50% 18%, rgba(232,184,74,0.16) 0%, transparent 55%),
            radial-gradient(ellipse 130% 90% at 50% 40%, #2f6348 0%, #1f4a34 42%, #163528 78%, #122a20 100%)
          `,
        }}
      />
      {/* Felt grain over entire viewport */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Soft table oval — decorative, not a height cut */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[4%] z-0 h-[min(48vh,380px)] w-[120%] -translate-x-1/2 rounded-[50%] border-[10px] border-[#3a2818]/75 opacity-85 shadow-[inset_0_0_70px_rgba(0,0,0,0.45)] sm:border-[12px]"
        style={{
          background:
            "radial-gradient(ellipse at center, #2d5c42 0%, #1a3d2c 50%, #143024 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[10%] z-0 h-[min(36vh,280px)] w-[78%] -translate-x-1/2 rounded-[50%] border border-[rgba(232,184,74,0.14)]"
      />

      <div className="relative z-10 flex min-h-dvh flex-col px-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:pt-6">
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
