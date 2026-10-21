import { HomeClient } from "@/components/HomeClient";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      {/* full-bleed atmosphere */}
      <div
        aria-hidden
        className="hero-atmosphere pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,#1a5c3a_0%,transparent_50%),radial-gradient(ellipse_at_80%_10%,#3d2a14_0%,transparent_40%),radial-gradient(ellipse_at_50%_100%,#0d3d28_0%,#04150f_70%)]"
      />
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute -left-1/4 top-1/4 h-[60vmax] w-[60vmax] rounded-full bg-[radial-gradient(circle,rgba(240,180,41,0.12),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="hero-copy relative z-10 flex flex-1 flex-col justify-center gap-10 px-0 py-16 sm:py-24">
        <div className="px-6">
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-amber-300 sm:text-7xl md:text-8xl">
            Poker Friends
          </h1>
          <p className="mt-5 max-w-md text-lg text-emerald-100/70 sm:text-xl">
            Texas Hold&apos;em em casa. Crie uma sala, chame os amigos pelo código e
            sente na mesa.
          </p>
        </div>

        <HomeClient />
      </div>

      <p className="relative z-10 px-6 pb-6 text-xs text-emerald-200/30">
        Até 10 assentos · polling leve · pronto para Vercel
      </p>
    </main>
  );
}
