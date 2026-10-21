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

  if (player.mode === "loading") {
    return (
      <div className="pf-gate pf-gate--plain">
        <p className="pf-note">Abrindo a mesa…</p>
      </div>
    );
  }

  if (player.mode === "none") {
    return (
      <div className="pf-hero">
        <div className="pf-hero__nav">
          <AuthBar />
        </div>
        <div className="pf-hero__body">
          <div>
            <h1 className="pf-title pf-title--hero">Poker Friends</h1>
            <p className="pf-lead">
              Hold&apos;em com a galera da igreja. Mesa quente, sem julgamento.
            </p>
          </div>
          {showcase}
          <div className="pf-stack">
            <button
              type="button"
              onClick={() => signIn("google")}
              className="pf-btn pf-btn--wax pf-btn--lg pf-btn--block"
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
              className="pf-btn pf-btn--ghost pf-btn--lg pf-btn--block"
            >
              Continuar como convidado
            </button>
            <p className="pf-note">
              Google guarda fichas na nuvem. Convidado fica só neste navegador.
            </p>
          </div>
          {error && <p className="pf-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="pf-frame pf-rise">
      <header className="pf-row pf-row--start">
        <div className="min-w-0">
          <h1 className="pf-title pf-title--page">Poker Friends</h1>
          <p className="pf-note">A paz do Senhor — e boa sorte na mesa.</p>
        </div>
        <AuthBar />
      </header>

      {error && <p className="pf-error">{error}</p>}

      <section className="pf-card pf-row">
        <div className="min-w-0">
          <p className="pf-kicker">Banco {player.isGuest ? "local" : "na nuvem"}</p>
          <p className="pf-bank">
            {player.bankBalance != null
              ? player.bankBalance.toLocaleString("pt-BR")
              : "—"}
            <span className="pf-note"> fichas</span>
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
            className="pf-btn pf-btn--soft pf-btn--sm"
          >
            Recarga diária
          </button>
        )}
      </section>
      {claimMsg && <p className="pf-note">{claimMsg}</p>}

      <section className="pf-stack">
        <label className="pf-stack">
          <span className="pf-kicker">Seu apelido</span>
          <div className="pf-field">
            <span aria-hidden>{profile?.emoji ?? "🙏"}</span>
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
            />
          </div>
        </label>

        <button
          type="button"
          onClick={() => setShowStyle((v) => !v)}
          className="pf-navlink"
          style={{ alignSelf: "flex-start", background: "none", border: 0, cursor: "pointer" }}
        >
          {showStyle ? "Fechar personalização" : "Personalizar emoji, ficha e feltro"}
        </button>

        {showStyle && options && (
          <div className="pf-card pf-stack">
            <div>
              <p className="pf-kicker">Emoji</p>
              <div className="pf-list" style={{ flexDirection: "row", flexWrap: "wrap" }} role="group" aria-label="Emoji">
                {options.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => saveStyle({ emoji: e })}
                    aria-pressed={profile?.emoji === e}
                    className="pf-seg"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="pf-kicker">Cor da ficha</p>
              <div className="pf-list" style={{ flexDirection: "row", flexWrap: "wrap" }} role="group" aria-label="Cor da ficha">
                {options.chipColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => saveStyle({ chipColor: c })}
                    aria-pressed={profile?.chipColor === c}
                    className="pf-swatch"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="pf-kicker">Feltro (sua visão)</p>
              <div className="pf-list" style={{ flexDirection: "row", flexWrap: "wrap" }} role="group" aria-label="Feltro">
                {options.felts.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => saveStyle({ feltAccent: f })}
                    aria-pressed={profile?.feltAccent === f}
                    className="pf-seg"
                  >
                    {options.feltLabels[f]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="pf-stack">
        <div>
          <p className="pf-kicker">Assentos na mesa</p>
          <div className="pf-list" style={{ flexDirection: "row", flexWrap: "wrap", marginTop: "0.4rem" }} role="group" aria-label="Máximo de assentos">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxSeats(n)}
                aria-pressed={maxSeats === n}
                className="pf-seg"
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
          className="pf-btn pf-btn--wax pf-btn--lg pf-btn--block"
        >
          Criar mesa
        </button>
        <div className="pf-split">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="CÓDIGO"
            className="pf-input pf-input--code"
            aria-label="Código da sala"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => join()}
            className="pf-btn pf-btn--ghost"
          >
            Entrar com código
          </button>
        </div>
      </section>

      <section>
        <h2 className="pf-title" style={{ fontSize: "1.25rem", marginBottom: "0.6rem" }}>
          Mesas ativas
        </h2>
        {rooms.length === 0 ? (
          <p className="pf-empty">Nenhuma mesa no ar — cria a primeira e chama a galera.</p>
        ) : (
          <ul className="pf-list">
            {rooms.map((r) => (
              <li key={r.code} className="pf-card pf-row">
                <div className="min-w-0">
                  <p className="pf-code">{r.code}</p>
                  <p className="pf-note" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {STATUS_LABEL[r.status] ?? r.status} · {r.smallBlind}/
                    {r.bigBlind} · {r.seatedCount}/{r.maxSeats ?? 10} · {r.hostName}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => join(r.code)}
                  className="pf-btn pf-btn--wax pf-btn--sm"
                >
                  Entrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
