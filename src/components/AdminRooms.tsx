"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type AdminPlayer = {
  id: string;
  nickname: string;
  seat: number | null;
  chips: number;
};

type AdminRoom = {
  code: string;
  status: string;
  handNumber: number;
  pot: number;
  street: string | null;
  playerCount: number;
  seatedCount: number;
  players: AdminPlayer[];
  hostId: string;
  lastAction: string | null;
  updatedAt: number;
};

export function AdminRooms() {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [store, setStore] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/rooms");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Falha ao carregar");
      return;
    }
    setRooms(data.rooms);
    setStore(data.store);
    setError(null);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  function closeRoom(code: string) {
    if (!confirm(`Fechar e apagar a sala ${code}?`)) return;
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao fechar");
        return;
      }
      await load();
    });
  }

  function kick(code: string, playerId: string, nick: string) {
    if (!confirm(`Expulsar ${nick} da sala ${code}?`)) return;
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kick", playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao expulsar");
        return;
      }
      await load();
    });
  }

  function ago(ts: number) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    return `${Math.floor(s / 3600)}h`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-100/50">
        <span>Store: {store || "…"}</span>
        <span>{rooms.length} sala(s)</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => load()}
          className="text-amber-200/80 underline-offset-2 hover:underline disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {rooms.length === 0 && !error && (
        <p className="text-emerald-100/50">Nenhuma sala ativa no momento.</p>
      )}

      <ul className="flex flex-col gap-4">
        {rooms.map((r) => (
          <li
            key={r.code}
            className="border border-emerald-700/40 bg-emerald-950/40 px-4 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xl tracking-widest text-amber-300">
                  {r.code}
                </p>
                <p className="mt-1 text-sm text-emerald-100/70">
                  {r.status}
                  {r.street ? ` · ${r.street}` : ""}
                  {r.handNumber > 0 ? ` · mão #${r.handNumber}` : ""}
                  {r.pot > 0 ? ` · pote ${r.pot}` : ""}
                  {" · "}
                  {r.seatedCount}/{r.playerCount} sentados
                  {" · "}
                  há {ago(r.updatedAt)}
                </p>
                {r.lastAction && (
                  <p className="mt-1 truncate text-xs text-amber-200/60">
                    {r.lastAction}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  href={`/sala/${r.code}`}
                  className="border border-amber-200/30 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/10"
                >
                  Abrir
                </a>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => closeRoom(r.code)}
                  className="border border-rose-400/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
                >
                  Fechar sala
                </button>
              </div>
            </div>

            <ul className="mt-3 flex flex-col gap-1 border-t border-emerald-800/40 pt-3 text-sm">
              {r.players.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-emerald-100/80"
                >
                  <span>
                    {p.nickname}
                    {p.id === r.hostId ? " · anfitrião" : ""}
                    {p.seat !== null ? ` · assento ${p.seat + 1}` : " · em pé"}
                    {" · "}
                    {p.chips} fichas
                  </span>
                  <button
                    type="button"
                    disabled={pending || r.status === "playing"}
                    onClick={() => kick(r.code, p.id, p.nickname)}
                    className="text-xs text-rose-300/80 hover:text-rose-200 disabled:opacity-30"
                  >
                    Expulsar
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
