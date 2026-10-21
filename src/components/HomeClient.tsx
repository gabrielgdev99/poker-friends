"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AuthBar } from "@/components/AuthBar";
import type { FeltAccent, UserProfile } from "@/lib/types";

type ActiveRoom = {
  code: string;
  status: string;
  smallBlind: number;
  bigBlind: number;
  playerCount: number;
  humanCount: number;
  seatedCount: number;
  hostName: string;
  handNumber: number;
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
  const { data: session, status } = useSession();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [showStyle, setShowStyle] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      const [profRes, roomsRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/rooms/active"),
      ]);
      if (cancelled) return;
      if (profRes.ok) {
        const data = await profRes.json();
        setProfile(data.profile);
        setOptions(data.options);
        setNickname(data.profile.nickname || session?.user?.name?.slice(0, 16) || "");
      } else if (session?.user?.name && !nickname) {
        setNickname(session.user.name.slice(0, 16));
      }
      if (roomsRes.ok) {
        const data = await roomsRes.json();
        setRooms(data.rooms ?? []);
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per auth
  }, [status, session?.user?.name]);

  useEffect(() => {
    if (search.get("login") === "1" && status === "unauthenticated") {
      setError("Entre com Google para criar ou entrar em uma sala.");
    }
    if (search.get("erro") === "sala") {
      const c = search.get("code");
      setError(
        c
          ? `Sala ${c} não encontrada ou não persistiu. Na Vercel, confira UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN, redeploy, e crie de novo.`
          : "Sala não encontrada. Crie outra ou confira o Redis na Vercel.",
      );
    }
  }, [search, status]);

  function saveProfilePatch(patch: Partial<UserProfile>) {
    start(async () => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao salvar estilo");
        return;
      }
      setProfile(data.profile);
      if (data.profile?.nickname) setNickname(data.profile.nickname);
    });
  }

  function create() {
    setError(null);
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    if (profile && nickname !== profile.nickname) {
      saveProfilePatch({ nickname });
    }
    start(async () => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname || session?.user?.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao criar sala");
        return;
      }
      if (!data.room?.code) {
        setError("Resposta inválida ao criar sala");
        return;
      }
      if (data.store === "memory") {
        setError(
          "Aviso: store em memória — a sala pode sumir na Vercel. Configure Upstash Redis.",
        );
      }
      router.push(`/sala/${data.room.code}`);
    });
  }

  function join(c?: string) {
    setError(null);
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    const roomCode = (c || code).trim().toUpperCase();
    if (roomCode.length < 4) {
      setError("Código inválido");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname || session?.user?.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao entrar");
        return;
      }
      router.push(`/sala/${roomCode}`);
    });
  }

  const loggedIn = status === "authenticated";

  return (
    <div className="relative z-10 flex w-full max-w-lg flex-col gap-6 px-6">
      <div className="flex items-center justify-end gap-4">
        <a
          href="/campeoes"
          className="text-xs uppercase tracking-wider text-amber-200/70 hover:text-amber-300"
        >
          Campeões
        </a>
        <AuthBar />
      </div>

      {!loggedIn && status !== "loading" && (
        <div className="flex flex-col gap-3 border-l-2 border-amber-500/60 pl-4">
          <p className="text-amber-50/70">
            Entra com Google pra sentar na mesa com a galera 🙏
          </p>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="w-fit bg-amber-500 px-6 py-3.5 font-[family-name:var(--font-display)] text-lg text-[#1a1208] transition hover:bg-amber-400"
          >
            Entrar com Google
          </button>
        </div>
      )}

      {loggedIn && (
        <>
          <div className="flex flex-col gap-2">
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
                      saveProfilePatch({ nickname: nickname.trim() });
                    }
                  }}
                  maxLength={16}
                  placeholder={session?.user?.name ?? "Como te chamam na mesa"}
                  className="min-w-0 flex-1 border-b border-amber-200/30 bg-transparent pb-2 text-lg text-amber-50 outline-none placeholder:text-emerald-100/30 focus:border-amber-400"
                />
              </div>
            </label>
            <button
              type="button"
              onClick={() => setShowStyle((v) => !v)}
              className="self-start text-xs uppercase tracking-wider text-amber-200/50 hover:text-amber-200"
            >
              {showStyle ? "Fechar estilo" : "Personalizar (emoji / ficha / feltro)"}
            </button>
            {showStyle && profile && options && (
              <div className="space-y-3 border border-amber-900/30 bg-black/20 p-3">
                <div>
                  <p className="mb-1 text-[0.65rem] uppercase tracking-wider text-amber-200/50">
                    Emoji
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {options.emojis.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => saveProfilePatch({ emoji: e })}
                        className={`px-1.5 text-xl ${
                          profile.emoji === e ? "bg-amber-500/30 ring-1 ring-amber-400" : ""
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[0.65rem] uppercase tracking-wider text-amber-200/50">
                    Cor da ficha
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {options.chipColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => saveProfilePatch({ chipColor: c })}
                        className={`h-7 w-7 rounded-full ${
                          profile.chipColor === c ? "ring-2 ring-amber-200" : ""
                        }`}
                        style={{ background: c }}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[0.65rem] uppercase tracking-wider text-amber-200/50">
                    Feltro da mesa (sua visão)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {options.felts.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => saveProfilePatch({ feltAccent: f })}
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
              </div>
            )}
          </div>

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
                        {STATUS_LABEL[r.status] ?? r.status} · blinds {r.smallBlind}/
                        {r.bigBlind} · {r.seatedCount} sentados · host {r.hostName}
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
