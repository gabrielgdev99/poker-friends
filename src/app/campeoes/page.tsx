import Link from "next/link";
import { AuthBar } from "@/components/AuthBar";
import { ChampionsBoard } from "@/components/ChampionsBoard";

export default function CampeoesPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,#3a2810_0%,transparent_50%),radial-gradient(ellipse_at_80%_100%,#1a4530_0%,transparent_45%)]"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-[0.65rem] uppercase tracking-[0.22em] text-amber-200/50 hover:text-amber-200"
            >
              ← Poker Friends
            </Link>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-amber-300 sm:text-4xl">
              Campeões
            </h1>
            <p className="mt-1 max-w-md text-sm text-amber-100/60">
              Quadro de honra da galera — fichas, mãos e mesas conquistadas. Glória ao
              Senhor e ao nuts 🙏
            </p>
          </div>
          <AuthBar />
        </div>
        <ChampionsBoard />
      </div>
    </main>
  );
}
