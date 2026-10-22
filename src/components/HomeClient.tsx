"use client";

import { signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AuthBar } from "@/components/AuthBar";
import { usePlayer } from "@/components/PlayerProvider";
import { feltCss } from "@/lib/felt";
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
      <div className="home-screen">
        <header className="home-bar">
          <div className="home-bar__titles">
            <p className="home-bar__title">Poker Friends</p>
            <p className="home-bar__meta">Abrindo a mesa…</p>
          </div>
        </header>
        <div className="home-felt">
          <div className="home-oval">
            <p className="home-center home-kicker">Abrindo a mesa…</p>
          </div>
        </div>
      </div>
    );
  }

  if (player.mode === "none") {
    return (
      <div className="home-screen">
        <header className="home-bar">
          <div className="home-bar__titles">
            <p className="home-bar__title">Poker Friends</p>
            <p className="home-bar__meta">Mesa da galera</p>
          </div>
          <AuthBar />
        </header>
        <div className="home-stage">
          <div className="home-felt">
            <div className="home-oval">
              <div className="home-center">
                {showcase}
                <p className="home-lead">
                  Hold&apos;em com a galera da igreja. Mesa quente, sem julgamento.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="home-dock">
          <div className="home-actions">
            {error && <p className="home-error">{error}</p>}
            <button
              type="button"
              onClick={() => signIn("google")}
              className="action-pill home-btn home-btn--raise"
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
              className="action-pill home-btn home-btn--ghost"
            >
              Continuar como convidado
            </button>
            <p className="home-note">
              Google guarda fichas na nuvem. Convidado fica só neste navegador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const felt = feltCss(profile?.feltAccent ?? "olive");

  return (
    <div
      className="home-screen"
      style={{
        ["--felt" as string]: felt.felt,
        ["--felt-lit" as string]: felt.feltLit,
      }}
    >
      <header className="home-bar">
        <div className="home-bar__titles">
          <p className="home-bar__title">Poker Friends</p>
          <p className="home-bar__meta">
            <Link href="/campeoes">Campeões</Link>
            {player.isAdmin && (
              <>
                {" · "}
                <Link href="/admin">Admin</Link>
              </>
            )}
            {" · "}
            A paz do Senhor
          </p>
        </div>
        <div className="home-bar__side">
          <button
            type="button"
            className="action-pill home-leave"
            onClick={() => {
              if (player.isGuest) void player.exitGuest();
              else void signOut();
            }}
          >
            Sair
          </button>
          <AuthBar compact />
        </div>
      </header>

      <div className="home-stage">
        <div className="home-felt">
          <div className="home-oval">
          <div className="home-center">
            <p className="home-kicker">Banco {player.isGuest ? "local" : "na nuvem"}</p>
            <p className="home-pot">
              {player.bankBalance != null
                ? player.bankBalance.toLocaleString("pt-BR")
                : "—"}
            </p>
            <p className="home-kicker">fichas</p>
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
                className="home-claim"
              >
                Recarga diária
              </button>
            )}
            {claimMsg && <p className="home-kicker">{claimMsg}</p>}
          </div>
          <div className="home-hero">
          <div className="home-plate">
            <span className="home-avatar" aria-hidden>
              {profile?.emoji ?? "🙏"}
            </span>
            <div className="home-plate__body">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => {
                  if (nickname.trim() && nickname !== profile?.nickname) {
                    saveStyle({ nickname: nickname.trim() });
                  }
                }}
                maxLength={16}
                className="home-nick"
                placeholder="Seu apelido"
                aria-label="Seu apelido"
              />
              <button
                type="button"
                onClick={() => setShowStyle((v) => !v)}
                className="home-plate__link"
              >
                {showStyle ? "Fechar" : "Emoji, ficha e feltro"}
              </button>
            </div>
          </div>
        </div>
        </div>
        </div>

        <div className="home-rooms" aria-label="Mesas ativas">
          {rooms.length === 0 ? (
            <p className="home-room home-room--empty">
              Nenhuma mesa no ar — cria a primeira e chama a galera.
            </p>
          ) : (
            rooms.map((r) => (
              <button
                key={r.code}
                type="button"
                disabled={pending}
                onClick={() => join(r.code)}
                className="home-room"
              >
                <span className="home-room__code">{r.code}</span>
                <span className="home-room__meta">
                  {STATUS_LABEL[r.status] ?? r.status} · {r.smallBlind}/{r.bigBlind} ·{" "}
                  {r.seatedCount}/{r.maxSeats ?? 10}
                </span>
                <span className="home-room__meta">{r.hostName}</span>
                <span className="home-room__go">Entrar</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="home-dock">
        <div className="home-actions">
          {error && <p className="home-error">{error}</p>}
          <div className="home-seats" role="group" aria-label="Máximo de assentos">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxSeats(n)}
                aria-pressed={maxSeats === n}
                className="home-seg"
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={create}
            className="action-pill home-btn home-btn--raise"
          >
            Criar mesa
          </button>
          <div className="home-join">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="CÓDIGO"
              className="home-code"
              aria-label="Código da sala"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => join()}
              className="action-pill home-btn home-btn--call"
              style={{ flex: 1 }}
            >
              Entrar com código
            </button>
          </div>
        </div>
      </div>

      {showStyle &&
        typeof document !== "undefined" &&
        createPortal(
        <div className="pf-modal-back">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Fechar personalização"
            onClick={() => setShowStyle(false)}
          />
          <div className="pf-modal">
            <div className="pf-row">
              <h2 className="pf-title" style={{ fontSize: "1.25rem" }}>
                Seu lugar na mesa
              </h2>
              <button
                type="button"
                className="pf-btn pf-btn--ghost pf-btn--sm"
                onClick={() => setShowStyle(false)}
              >
                ✕
              </button>
            </div>
            <div className="pf-stack" style={{ marginTop: "0.8rem" }}>
              {!options && <p className="home-kicker">Carregando…</p>}
              {options && (
              <>
              <div>
                <p className="home-kicker">Emoji</p>
                <div className="pf-wrap" role="group" aria-label="Emoji">
                  {options.emojis.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => saveStyle({ emoji: e })}
                      aria-pressed={profile?.emoji === e}
                      className="home-seg"
                      style={{ flex: "none", minWidth: "2.2rem" }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="home-kicker">Cor da ficha</p>
                <div className="pf-wrap" role="group" aria-label="Cor da ficha">
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
                <p className="home-kicker">Feltro (sua visão)</p>
                <div className="pf-wrap" role="group" aria-label="Feltro">
                  {options.felts.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => saveStyle({ feltAccent: f })}
                      aria-pressed={profile?.feltAccent === f}
                      className="home-seg"
                      style={{ flex: "none" }}
                    >
                      {options.feltLabels[f]}
                    </button>
                  ))}
                </div>
              </div>
              </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
