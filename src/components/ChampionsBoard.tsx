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
    <section className="pf-card" style={{ minWidth: 0 }}>
      <h2 className="pf-title" style={{ fontSize: "1.25rem" }}>
        {title}
      </h2>
      <p className="pf-note">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="pf-empty" style={{ marginTop: "0.7rem" }}>
          Ainda vazio — joga uma mesa pra entrar.
        </p>
      ) : (
        <ol>
          {rows.map((r, i) => (
            <li key={`${valueKey}-${r.id}`} className="pf-rank">
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span className="pf-note">{i + 1}. </span>
                {r.nickname}
              </span>
              <span className="pf-code" style={{ letterSpacing: 0, flex: "none" }}>
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
    return <p className="pf-error">{error}</p>;
  }
  if (!boards) {
    return <p className="pf-note">Carregando o quadro…</p>;
  }

  return (
    <div className="pf-boards">
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
