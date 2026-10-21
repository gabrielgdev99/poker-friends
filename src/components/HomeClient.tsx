"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { AuthBar } from "@/components/AuthBar";
import { usePlayer } from "@/components/PlayerProvider";
import type { FeltAccent, UserProfile } from "@/lib/types";

type ActiveRoom = {
  code: string;
  status: string;
  smallBlind: number;
  bigBlind: number;
  seatedCount: number;
  maxSeats?: number;
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
  playing: "Na mão",
  showdown: "Showdown",
};

export function HomeClient({ showcase }: { showcase?: ReactNode }) {
  const router = useRouter();
  const search = useSearchParams();
  const player = usePlayer();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [maxSeats, setMaxSeats] = useState(6);
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
    setProfile((p) => {
      const base: UserProfile = p ?? {
        nickname: nickname || player.name || "Jogador",
        emoji: "🙏",
        chipColor: "#f0b429",
        feltAccent: "olive",
      };
      return { ...base, ...patch };
    });
    if (patch.nickname) setNickname(patch.nickname);

    if (player.isGuest) {
      player.updateGuestPrefs(patch);
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
      if (data.profile) {
        setProfile(data.profile as UserProfile);
        if (data.profile.nickname) setNickname(data.profile.nickname);
      }
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
        body: JSON.stringify({
          nickname: nickname || player.name,
          maxSeats,
        }),
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

  /* ── Loading ── */
  if (player.mode === "loading") {
    return (
      <div className="flex flex-1 flex-col justify-end px-6 pb-16 sm:justify-center sm:px-10">
        <p className="text-sm text-[var(--fc-ink-mute)]">Abrindo a mesa…</p>
      </div>
    );
  }

  /* ── Logged out: brand-first hero + single CTA pair ── */
  if (player.mode === "none") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex justify-end px-5 pt-1 sm:px-10">
          <AuthBar />
        </div>

        <div className="flex flex-1 flex-col justify-end gap-5 px-6 pb-6 pt-8 sm:justify-center sm:gap-7 sm:px-10 sm:pb-12">
          <div className="max-w-xl">
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(3.75rem,15vw,7.5rem)] leading-[0.86] tracking-tight text-[var(--fc-wax)]">
              Poker Friends
            </h1>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-[var(--fc-ink)]/75 sm:mt-4 sm:text-lg">
              Hold&apos;em com a galera da igreja. Mesa quente, sem julgamento.
            </p>
          </div>

          {showcase}

          <div className="flex w-full max-w-md flex-col gap-2.5">
            <button
              type="button"
              onClick={() => signIn("google")}
              className="action-pill w-full rounded-full bg-[var(--fc-wax)] px-6 py-3.5 font-[family-name:var(--font-display)] text-lg font-semibold text-[#1a140c] shadow-[0_8px_28px_rgba(232,184,74,0.28)] transition hover:bg-[var(--fc-wax-hot)]"
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
              className="action-pill w-full rounded-full border border-[var(--fc-ink)]/25 bg-transparent px-6 py-3.5 text-[var(--fc-ink)] transition hover:bg-white/5 disabled:opacity-50"
            >
              Continuar como convidado
            </button>
            <p className="text-xs leading-relaxed text-[var(--fc-ink-mute)]">
              Google guarda fichas na nuvem. Convidado fica só neste navegador.
            </p>
          </div>

          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      </div>
    );
  }

  /* ── Lobby (logged in) ── */
  return (
    <div className="fc-lobby-in mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 pb-8 pt-2 sm:px-8 sm:pt-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-tight text-[var(--fc-wax)] sm:text-4xl">
            Poker Friends
          </h1>
          <p className="mt-1 text-sm text-[var(--fc-ink-mute)]">
            A paz do Senhor — e boa sorte na mesa.
          </p>
        </div>
        <AuthBar />
      </header>

      {/* Bank */}
      <section className="fc-lobby-in-delay flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/25 px-4 py-3 backdrop-blur-sm">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--fc-ink-mute)]">
            Banco {player.isGuest ? "local" : "na nuvem"}
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl tabular-nums text-[var(--fc-wax)]">
            {player.bankBalance != null
              ? player.bankBalance.toLocaleString("pt-BR")
              : "—"}
            <span className="ml-1.5 text-sm font-normal text-[var(--fc-ink-mute)]">
              fichas
            </span>
          </p>
        </div>
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
            className="action-pill shrink-0 rounded-full border border-[var(--fc-wax)]/35 bg-[var(--fc-wax)]/10 px-3.5 py-2 text-xs font-medium text-[var(--fc-wax)] hover:bg-[var(--fc-wax)]/20 disabled:opacity-35"
          >
            Recarga diária
          </button>
        )}
      </section>
      {claimMsg && (
        <p className="-mt-3 text-xs text-[var(--fc-wax)]/80">{claimMsg}</p>
      )}

      {/* Identity */}
      <section className="space-y-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--fc-ink-mute)]">
            Seu apelido
          </span>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
            <span className="text-xl" aria-hidden>
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
              className="min-w-0 flex-1 bg-transparent text-lg text-[var(--fc-ink)] outline-none placeholder:text-[var(--fc-ink-mute)]"
              placeholder="Como te chamam na mesa"
            />
          </div>
        </label>

        <button
          type="button"
          onClick={() => setShowStyle((v) => !v)}
          className="text-xs text-[var(--fc-clay-light)] underline-offset-2 hover:underline"
        >
          {showStyle ? "Fechar personalização" : "Personalizar emoji, ficha e feltro"}
        </button>

        {showStyle && options && (
          <div className="space-y-4 rounded-2xl border border-white/8 bg-black/20 p-4">
            <div>
              <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-[var(--fc-ink-mute)]">
                Emoji
              </p>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Emoji">
                {options.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => saveStyle({ emoji: e })}
                    aria-pressed={profile?.emoji === e}
                    className={`rounded-lg px-1.5 text-lg ${
                      profile?.emoji === e
                        ? "bg-[var(--fc-wax)]/30 ring-1 ring-[var(--fc-wax)]"
                        : "hover:bg-white/5"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-[var(--fc-ink-mute)]">
                Cor da ficha
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Cor da ficha">
                {options.chipColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => saveStyle({ chipColor: c })}
                    aria-pressed={profile?.chipColor === c}
                    className={`h-8 w-8 rounded-full ${
                      profile?.chipColor === c
                        ? "ring-2 ring-[var(--fc-wax)] ring-offset-2 ring-offset-[#0a100c]"
                        : ""
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-[var(--fc-ink-mute)]">
                Feltro (sua visão)
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Feltro">
                {options.felts.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => saveStyle({ feltAccent: f })}
                    aria-pressed={profile?.feltAccent === f}
                    className={`rounded-full px-3 py-1.5 text-xs ${
                      profile?.feltAccent === f
                        ? "bg-[var(--fc-wax)]/20 text-[var(--fc-wax)] ring-1 ring-[var(--fc-wax)]/50"
                        : "bg-white/5 text-[var(--fc-ink-mute)] hover:bg-white/8"
                    }`}
                  >
                    {options.feltLabels[f]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Create / join */}
      <section className="space-y-3">
        <div>
          <p className="mb-2 text-[0.6rem] uppercase tracking-[0.18em] text-[var(--fc-ink-mute)]">
            Assentos na mesa
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Máximo de assentos">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxSeats(n)}
                aria-pressed={maxSeats === n}
                className={`min-w-[2.35rem] rounded-full px-2 py-1.5 text-sm tabular-nums transition ${
                  maxSeats === n
                    ? "bg-[var(--fc-wax)] font-semibold text-[#1a140c]"
                    : "bg-white/5 text-[var(--fc-ink-mute)] hover:bg-white/10"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={create}
          className="action-pill w-full rounded-full bg-[var(--fc-wax)] py-3.5 font-[family-name:var(--font-display)] text-lg font-semibold text-[#1a140c] shadow-[0_8px_24px_rgba(232,184,74,0.22)] hover:bg-[var(--fc-wax-hot)] disabled:opacity-55"
        >
          Criar mesa
        </button>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="CÓDIGO"
            className="w-[6.5rem] rounded-full border border-white/10 bg-black/30 px-3 py-3 text-center font-mono tracking-[0.2em] text-[var(--fc-ink)] outline-none focus:border-[var(--fc-wax)]/50"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => join()}
            className="action-pill flex-1 rounded-full border border-[var(--fc-ink)]/20 py-3 text-[var(--fc-ink)] hover:bg-white/5 disabled:opacity-55"
          >
            Entrar com código
          </button>
        </div>
      </section>

      {/* Active tables */}
      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl text-[var(--fc-ink)]">
          Mesas ativas
        </h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-[var(--fc-ink-mute)]">
            Nenhuma mesa no ar — cria a primeira e chama a galera.
          </p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((r) => (
              <li
                key={r.code}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm tracking-[0.18em] text-[var(--fc-wax)]">
                    {r.code}
                  </p>
                  <p className="truncate text-[0.7rem] text-[var(--fc-ink-mute)]">
                    {STATUS_LABEL[r.status] ?? r.status} · {r.smallBlind}/
                    {r.bigBlind} · {r.seatedCount}/{r.maxSeats ?? 10} ·{" "}
                    {r.hostName}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => join(r.code)}
                  className="action-pill shrink-0 rounded-full bg-[var(--fc-wax)]/90 px-3.5 py-1.5 text-xs font-semibold text-[#1a140c] hover:bg-[var(--fc-wax)]"
                >
                  Entrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="text-sm text-rose-300">{error}</p>}
    </div>
  );
}
