"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getOrCreatePlayerId } from "@/lib/player-id";

export function HomeClient() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    start(async () => {
      const playerId = getOrCreatePlayerId();
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname || "Anfitrião", playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao criar sala");
        return;
      }
      router.push(`/sala/${data.room.code}`);
    });
  }

  function join() {
    setError(null);
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setError("Código inválido");
      return;
    }
    start(async () => {
      const playerId = getOrCreatePlayerId();
      const res = await fetch(`/api/rooms/${c}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname || "Jogador", playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao entrar");
        return;
      }
      router.push(`/sala/${c}`);
    });
  }

  return (
    <div className="relative z-10 flex w-full max-w-lg flex-col gap-6 px-6">
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
          Apelido
        </span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={16}
          placeholder="Como te chamam na mesa"
          className="border-b border-amber-200/30 bg-transparent pb-2 text-lg text-amber-50 outline-none placeholder:text-emerald-100/30 focus:border-amber-400"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={create}
          className="flex-1 bg-amber-500 px-6 py-3.5 font-[family-name:var(--font-display)] text-lg text-emerald-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          Criar sala
        </button>
        <div className="flex flex-1 gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="CÓDIGO"
            className="w-28 border border-emerald-400/20 bg-emerald-950/40 px-3 py-3 text-center font-mono tracking-widest text-amber-100 outline-none focus:border-amber-400/50"
          />
          <button
            type="button"
            disabled={pending}
            onClick={join}
            className="flex-1 border border-amber-200/40 px-4 py-3.5 text-amber-100 transition hover:bg-amber-500/10 disabled:opacity-60"
          >
            Entrar
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
    </div>
  );
}
