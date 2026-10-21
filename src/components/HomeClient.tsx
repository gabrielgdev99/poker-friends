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
      setError("Entre com Google ou continue como convidado.");
    }
    if (search.get("erro") === "sala") {
      const c = search.get("code");
      setError(
        c
          ? `Sala ${c} não encontrada ou foi encerrada.`
          : "Sala não encontrada.",
      );
    }
  }, [search, player.mode]);

  function saveStyle(patch: Partial<UserProfile>) {
    if (player.isGuest) {
      player.updateGuestPrefs(patch);
      setProfile((p) =>
        p
          ? { ...p, ...patch }
          : {
              nickname: nickname || "Convidado",
              emoji: "☕",
              chipColor: "#f0b429",
              feltAccent: "olive",
              ...patch,
            },
      );
      if (patch.nickname) setNickname(patch.nickname);
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

  function goSala(roomCode: string) {
    router.push(`/sala/${roomCode}`);
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
      if (!data.room?.code) {
        setError("Resposta inválida");
        return;
      }
      if (player.isGuest) player.noteGuestBuyIn();
      else await player.refreshBank();
      goSala(data.room.code);
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
      goSala(roomCode);
    });
  }

  return (
    <div className="relative z-10 flex w-full max-w-md flex-col gap-5 px-6 sm:px-10">
      <div className="flex justify-end">
        <AuthBar />
      </div>

      {player.mode === "loading" && (
        <p className="text-sm text-amber-100/40">Carregando…</p>
      )}

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
                  await player.continueAsGuest("Convidado");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Falha no convidado");
                }
              });
            }}
            className="w-full border border-amber-200/50 px-6 py-3.5 text-amber-50 transition hover:bg-amber-500/10 disabled:opacity-50"
          >
            Continuar como convidado
          </button>
          <p className="text-xs leading-relaxed text-amber-100/45">
            Google guarda fichas na nuvem. Convidado usa fichas locais neste
            navegador.
          </p>
        </div>
      )}

      {loggedIn && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-900/30 pb-3">
            <p className="text-sm text-amber-100/80">
              Banco{" "}
              <strong className="tabular-nums text-amber-300">
                {player.bankBalance != null
                  ? player.bankBalance.toLocaleString("pt-BR")
                  : "—"}
              </strong>
              <span className="text-amber-100/40">
                {player.isGuest ? " · local" : " · buy-in 1k"}
              </span>
            </p>
            {!player.isGuest && (
              <button
                type="button"
                disabled={pending || !player.canClaimDaily}
                onClick={() => {
                  start(async () => {
                    const err = await player.claimDaily();
                    setClaimMsg(err ? err : "+2.500 na conta 🙏");
                  });
                }}
                className="text-xs text-amber-200/80 underline-offset-2 hover:underline disabled:opacity-40"
              >
                Recarga diária
              </button>
            )}
          </div>
          {claimMsg && <p className="text-xs text-amber-200/70">{claimMsg}</p>}

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-amber-200/60">
              Apelido
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl">{profile?.emoji ?? "🙏"}</span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => {
                  if (nickname.trim() && nickname !== profile?.nickname) {
                    saveStyle({ nickname: nickname.trim() });
                  }
                }}
                maxLength={16}
                className="min-w-0 flex-1 border-b border-amber-200/30 bg-transparent pb-1.5 text-lg text-amber-50 outline-none focus:border-amber-400"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={() => setShowStyle((v) => !v)}
            className="self-start text-[0.65rem] uppercase tracking-wider text-amber-200/45 hover:text-amber-200"
          >
            {showStyle ? "Fechar estilo" : "Personalizar"}
          </button>
          {showStyle && options && (
            <div className="space-y-2 border border-amber-900/30 bg-black/20 p-3">
              <div className="flex flex-wrap gap-1">
                {options.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => saveStyle({ emoji: e })}
                    className={`px-1 text-lg ${
                      profile?.emoji === e ? "bg-amber-500/30" : ""
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
                    className={`h-6 w-6 rounded-full ${
                      profile?.chipColor === c ? "ring-2 ring-amber-200" : ""
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={pending}
              onClick={create}
              className="flex-1 bg-amber-500 px-5 py-3 font-[family-name:var(--font-display)] text-lg text-emerald-950 hover:bg-amber-400 disabled:opacity-60"
            >
              Criar sala
            </button>
            <div className="flex flex-1 gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="CÓDIGO"
                className="w-24 border border-emerald-400/20 bg-black/30 px-2 py-3 text-center font-mono tracking-widest text-amber-100 outline-none focus:border-amber-400/50"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => join()}
                className="flex-1 border border-amber-200/40 px-3 py-3 text-amber-100 hover:bg-amber-500/10 disabled:opacity-60"
              >
                Entrar
              </button>
            </div>
          </div>

          <section>
            <h2 className="mb-2 font-[family-name:var(--font-display)] text-base text-amber-200">
              Mesas ativas
            </h2>
            {rooms.length === 0 ? (
              <p className="text-sm text-amber-100/40">Nenhuma mesa no ar.</p>
            ) : (
              <ul className="space-y-1.5">
                {rooms.map((r) => (
                  <li
                    key={r.code}
                    className="flex items-center justify-between gap-2 border-b border-amber-900/20 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-mono tracking-widest text-amber-300">
                        {r.code}
                      </p>
                      <p className="truncate text-[0.7rem] text-amber-100/50">
                        {STATUS_LABEL[r.status] ?? r.status} · {r.smallBlind}/
                        {r.bigBlind} · {r.seatedCount} · {r.hostName}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => join(r.code)}
                      className="shrink-0 bg-amber-500/90 px-3 py-1 text-xs font-medium text-emerald-950 hover:bg-amber-400"
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
