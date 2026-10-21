"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AuthBar } from "@/components/AuthBar";
import { usePlayer } from "@/components/PlayerProvider";
import type { FeltAccent, UserProfile } from "@/lib/types";

type ActiveRoom = {
  code: string;
  status: string;
  smallBlind: number;
  bigBlind: number;
  playerCount: number;
  seatedCount: number;
  hostName: string;
};

type ProfileOptions = {
  emojis: string[];
  chipColors: string[];
  felts: FeltAccent[];
  feltLabels: Record<FeltAccent, string>;
};

const STATUS_LABEL: Record<string, string> = {
  lobby: "Lobby",
  playing: "Jogando",
  showdown: "Showdown",
};

export function HomeClient() {
  const router = useRouter();
  const search = useSearchParams();
  const player = usePlayer();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [showStyle, setShowStyle] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const loggedIn = player.mode === "google" || player.mode === "guest";

  useEffect(() => {
    if (player.mode === "guest" && player.guest) {
      setNickname(player.guest.nickname);
      setProfile({
        nickname: player.guest.nickname,
        emoji: player.guest.emoji,
        chipColor: player.guest.chipColor,
        feltAccent: player.guest.feltAccent,
      });
      return;
    }
    if (player.mode === "google") {
      setNickname((n) => n || player.name.slice(0, 16));
    }
  }, [player.mode, player.guest, player.name]);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    (async () => {
      const [profRes, roomsRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/rooms/active"),
      ]);
      if (cancelled) return;
      if (profRes.ok) {
        const data = await profRes.json();
        setOptions(data.options);
        if (player.mode === "google") {
          setProfile(data.profile);
          setNickname(data.profile.nickname || player.name.slice(0, 16));
        } else if (!options) {
          setOptions(data.options);
        }
      }
      if (roomsRes.ok) {
        const data = await roomsRes.json();
        setRooms(data.rooms ?? []);
      }
      await player.refreshBank();
    })();
    const t = setInterval(() => {
      fetch("/api/rooms/active")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.rooms) setRooms(d.rooms);
        })
        .catch(() => {});
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, player.mode]);

  useEffect(() => {
    if (search.get("login") === "1" && player.mode === "none") {
      setError("Entre com Google ou continue como convidado pra jogar.");
    }
    if (search.get("erro") === "sala") {
      const c = search.get("code");
      setError(
        c
          ? `Sala ${c} não encontrada. Confira o Redis na Vercel ou cria de novo.`
          : "Sala não encontrada.",
      );
    }
  }, [search, player.mode]);

  function saveStyle(patch: Partial<UserProfile>) {
    if (player.isGuest) {
      player.updateGuestPrefs(patch);
      setProfile((p) => (p ? { ...p, ...patch } : null));
      if (patch.nickname) setNickname(patch.nickname);
      // best-effort sync to server profile
      void fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      return;
    }
    start(async () => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao salvar");
        return;
      }
      setProfile(data.profile);
      if (data.profile?.nickname) setNickname(data.profile.nickname);
    });
  }

  function create() {
    setError(null);
    if (!loggedIn) return;
    start(async () => {
      if (nickname.trim() && nickname !== profile?.nickname) {
        saveStyle({ nickname: nickname.trim() });
      }
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname || player.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao criar sala");
        return;
      }
      if (player.isGuest) player.noteGuestBuyIn();
      else await player.refreshBank();
      router.push(`/sala/${data.room.code}`);
    });
  }

  function join(c?: string) {
    setError(null);
    if (!loggedIn) return;
    const roomCode = (c || code).trim().toUpperCase();
    if (roomCode.length < 4) {
      setError("Código inválido");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname || player.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao entrar");
        return;
      }
      if (player.isGuest && data.buyIn > 0) player.noteGuestBuyIn();
      else await player.refreshBank();
      router.push(`/sala/${roomCode}`);
    });
  }

  return (
    <div className="relative z-10 flex w-full max-w-lg flex-col gap-5 px-6 sm:px-10">
      <div className="flex justify-end">
        <AuthBar />
      </div>

      {player.mode === "none" && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => signIn("google")}
            className="w-full bg-amber-500 px-6 py-3.5 font-[family-name:var(--font-display)] text-lg text-[#1a1208] transition hover:bg-amber-400 active:scale-[0.99]"
          >
            Entrar com Google
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                try {
                  await player.continueAsGuest(nickname || "Convidado");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Falha no convidado");
                }
              });
            }}
            className="w-full border border-amber-200/45 px-6 py-3.5 text-amber-50 transition hover:bg-amber-500/10 disabled:opacity-50"
          >
            Continuar como convidado
          </button>
          <p className="text-xs text-amber-100/45">
            Google: banco de fichas na nuvem + recarga diária. Convidado: fichas
            no seu navegador (localStorage).
          </p>
        </div>
      )}

      {loggedIn && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-900/30 bg-black/25 px-3 py-2">
            <p className="text-sm text-amber-100/80">
              Banco{" "}
              <strong className="tabular-nums text-amber-300">
                {player.bankBalance != null
                  ? player.bankBalance.toLocaleString("pt-BR")
                  : "—"}
              </strong>
              {player.isGuest ? (
                <span className="text-amber-100/45"> · local</span>
              ) : (
                <span className="text-amber-100/45"> · buy-in 1.000</span>
              )}
            </p>
            {!player.isGuest && (
              <button
                type="button"
                disabled={pending || !player.canClaimDaily}
                onClick={() => {
                  start(async () => {
                    const err = await player.claimDaily();
                    setClaimMsg(err ? err : "Recarga diária +2.500 🙏");
                  });
                }}
                className="border border-amber-400/40 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/15 disabled:opacity-40"
              >
                Recarga diária
              </button>
            )}
          </div>
          {claimMsg && (
            <p className="text-xs text-amber-200/70">{claimMsg}</p>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
              Apelido na mesa
            </span>
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {profile?.emoji ?? "🙏"}
              </span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => {
                  if (nickname.trim() && nickname !== profile?.nickname) {
                    saveStyle({ nickname: nickname.trim() });
                  }
                }}
                maxLength={16}
                placeholder="Como te chamam na mesa"
                className="min-w-0 flex-1 border-b border-amber-200/30 bg-transparent pb-2 text-lg text-amber-50 outline-none placeholder:text-emerald-100/30 focus:border-amber-400"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={() => setShowStyle((v) => !v)}
            className="self-start text-xs uppercase tracking-wider text-amber-200/50 hover:text-amber-200"
          >
            {showStyle ? "Fechar estilo" : "Personalizar"}
          </button>
          {showStyle && profile && options && (
            <div className="space-y-3 border border-amber-900/30 bg-black/20 p-3">
              <div className="flex flex-wrap gap-1">
                {options.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => saveStyle({ emoji: e })}
                    className={`px-1.5 text-xl ${
                      profile.emoji === e ? "bg-amber-500/30 ring-1 ring-amber-400" : ""
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {options.chipColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => saveStyle({ chipColor: c })}
                    className={`h-7 w-7 rounded-full ${
                      profile.chipColor === c ? "ring-2 ring-amber-200" : ""
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {options.felts.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => saveStyle({ feltAccent: f })}
                    className={`border px-2 py-1 text-xs ${
                      profile.feltAccent === f
                        ? "border-amber-400 text-amber-200"
                        : "border-amber-900/40 text-amber-100/60"
                    }`}
                  >
                    {options.feltLabels[f]}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                onClick={() => join()}
                className="flex-1 border border-amber-200/40 px-4 py-3.5 text-amber-100 transition hover:bg-amber-500/10 disabled:opacity-60"
              >
                Entrar
              </button>
            </div>
          </div>

          <section className="border-t border-amber-900/30 pt-4">
            <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg text-amber-200">
              Mesas ativas
            </h2>
            {rooms.length === 0 ? (
              <p className="text-sm text-amber-100/40">
                Nenhuma mesa no ar — cria uma e chama a galera.
              </p>
            ) : (
              <ul className="space-y-2">
                {rooms.map((r) => (
                  <li
                    key={r.code}
                    className="flex flex-wrap items-center justify-between gap-2 border border-amber-900/25 bg-black/15 px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-mono tracking-widest text-amber-300">{r.code}</p>
                      <p className="truncate text-xs text-amber-100/55">
                        {STATUS_LABEL[r.status] ?? r.status} · {r.smallBlind}/
                        {r.bigBlind} · {r.seatedCount} sentados · {r.hostName}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => join(r.code)}
                      className="shrink-0 bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-amber-400 disabled:opacity-50"
                    >
                      Entrar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {error && <p className="text-sm text-rose-300">{error}</p>}
    </div>
  );
}
