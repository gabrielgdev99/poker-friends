"use client";

import { useEffect, useState } from "react";
import type { LeaderRow } from "@/lib/stats";

type Boards = {
  chipsWon: LeaderRow[];
  handsWon: LeaderRow[];
  tablesWon: LeaderRow[];
};

function Board({
  title,
  subtitle,
  rows,
  valueKey,
  format,
}: {
  title: string;
  subtitle: string;
  rows: LeaderRow[];
  valueKey: keyof Pick<LeaderRow, "chipsWon" | "handsWon" | "tablesWon">;
  format: (n: number) => string;
}) {
  return (
    <section className="min-w-0">
      <h2 className="font-[family-name:var(--font-display)] text-xl text-amber-200">
        {title}
      </h2>
      <p className="mb-3 text-xs text-amber-100/45">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-amber-100/40">Ainda vazio — joga uma mesa pra entrar.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li
              key={`${valueKey}-${r.id}`}
              className="flex items-baseline justify-between gap-3 border-b border-amber-900/25 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="mr-2 tabular-nums text-amber-200/40">{i + 1}.</span>
                <span className="text-amber-50/90">{r.nickname}</span>
              </span>
              <span className="shrink-0 tabular-nums font-medium text-amber-300">
                {format(r[valueKey])}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChampionsBoard() {
  const [boards, setBoards] = useState<Boards | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/stats");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Não deu pra carregar o ranking");
        return;
      }
      setBoards(data as Boards);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }
  if (!boards) {
    return <p className="text-sm text-amber-100/50">Carregando o quadro…</p>;
  }

  return (
    <div className="grid gap-8 sm:grid-cols-3">
      <Board
        title="Fichas"
        subtitle="Mais fichas ganhas nos potes"
        rows={boards.chipsWon}
        valueKey="chipsWon"
        format={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))}
      />
      <Board
        title="Mãos"
        subtitle="Mais mãos vencidas"
        rows={boards.handsWon}
        valueKey="handsWon"
        format={(n) => String(n)}
      />
      <Board
        title="Mesas"
        subtitle="Último de pé — mesas conquistadas"
        rows={boards.tablesWon}
        valueKey="tablesWon"
        format={(n) => String(n)}
      />
    </div>
  );
}
