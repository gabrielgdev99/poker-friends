"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AuthBar } from "@/components/AuthBar";

export function HomeClient() {
  const router = useRouter();
  const search = useSearchParams();
  const { data: session, status } = useSession();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (session?.user?.name && !nickname) {
      setNickname(session.user.name.slice(0, 16));
    }
  }, [session, nickname]);

  useEffect(() => {
    if (search.get("login") === "1" && status === "unauthenticated") {
      setError("Entre com Google para criar ou entrar em uma sala.");
    }
  }, [search, status]);

  function create() {
    setError(null);
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    start(async () => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname || session?.user?.name }),
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
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setError("Código inválido");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/rooms/${c}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname || session?.user?.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao entrar");
        return;
      }
      router.push(`/sala/${c}`);
    });
  }

  const loggedIn = status === "authenticated";

  return (
    <div className="relative z-10 flex w-full max-w-lg flex-col gap-6 px-6">
      <div className="flex justify-end">
        <AuthBar />
      </div>

      {!loggedIn && status !== "loading" && (
        <div className="flex flex-col gap-3 border-l-2 border-amber-500/60 pl-4">
          <p className="text-emerald-100/70">
            Faça login com Google para criar ou entrar em uma sala.
          </p>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="w-fit bg-amber-500 px-6 py-3.5 font-[family-name:var(--font-display)] text-lg text-emerald-950 transition hover:bg-amber-400"
          >
            Entrar com Google
          </button>
        </div>
      )}

      {loggedIn && (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
              Apelido na mesa
            </span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={16}
              placeholder={session?.user?.name ?? "Como te chamam na mesa"}
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
        </>
      )}

      {error && <p className="text-sm text-rose-300">{error}</p>}
    </div>
  );
}
