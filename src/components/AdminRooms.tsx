"use client";

import Link from "next/link";
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
    <div className="pf-stack">
      <div className="pf-row" style={{ flexWrap: "wrap", justifyContent: "flex-start" }}>
        <span className="pf-note">Store: {store || "…"}</span>
        <span className="pf-note">{rooms.length} sala(s)</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => load()}
          className="pf-navlink"
          style={{ background: "none", border: 0, cursor: "pointer" }}
        >
          Atualizar
        </button>
      </div>

      {error && <p className="pf-error">{error}</p>}

      {rooms.length === 0 && !error && (
        <p className="pf-empty">Nenhuma sala ativa no momento.</p>
      )}

      <ul className="pf-list">
        {rooms.map((r) => (
          <li key={r.code} className="pf-card">
            <div className="pf-row pf-row--start" style={{ flexWrap: "wrap" }}>
              <div className="min-w-0" style={{ flex: "1 1 12rem" }}>
                <p className="pf-code" style={{ fontSize: "1.15rem" }}>
                  {r.code}
                </p>
                <p className="pf-note">
                  {r.status}
                  {r.street ? ` · ${r.street}` : ""}
                  {r.handNumber > 0 ? ` · mão #${r.handNumber}` : ""}
                  {r.pot > 0 ? ` · pote ${r.pot}` : ""}
                  {" · "}
                  {r.seatedCount}/{r.playerCount} sentados
                  {" · "}
                  há {ago(r.updatedAt)}
                </p>
                {r.lastAction && <p className="pf-note pf-ellipsis">{r.lastAction}</p>}
              </div>
              <div className="pf-wrap">
                <Link href={`/sala/${r.code}`} className="pf-btn pf-btn--ghost pf-btn--sm">
                  Abrir
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => closeRoom(r.code)}
                  className="pf-btn pf-btn--danger pf-btn--sm"
                >
                  Fechar sala
                </button>
              </div>
            </div>

            <ul className="pf-list" style={{ marginTop: "0.7rem" }}>
              {r.players.map((p) => (
                <li key={p.id} className="pf-row" style={{ flexWrap: "wrap" }}>
                  <span className="pf-note" style={{ color: "var(--fc-ink)" }}>
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
                    className="pf-navlink"
                    style={{ background: "none", border: 0, cursor: "pointer", color: "#fda4af" }}
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
