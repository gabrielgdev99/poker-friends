"use client";

import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { usePlayer } from "@/components/PlayerProvider";

export function AuthBar() {
  const player = usePlayer();

  if (player.mode === "loading") {
    return (
      <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/40">…</p>
    );
  }

  if (player.mode === "none") {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="border border-amber-200/40 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/10 sm:px-4 sm:py-2 sm:text-sm"
      >
        Entrar com Google
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <Link
        href="/campeoes"
        className="text-[0.65rem] uppercase tracking-wider text-amber-200/70 hover:text-amber-300 sm:text-xs"
      >
        Campeões
      </Link>
      {player.bankBalance != null && (
        <span className="tabular-nums text-[0.65rem] text-amber-300/90 sm:text-xs">
          🪙 {player.bankBalance.toLocaleString("pt-BR")}
          {player.isGuest ? " local" : ""}
        </span>
      )}
      {player.isAdmin && (
        <Link
          href="/admin"
          className="text-[0.65rem] uppercase tracking-wider text-amber-400 hover:text-amber-300 sm:text-xs"
        >
          Admin
        </Link>
      )}
      {player.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.image}
          alt=""
          className="h-7 w-7 rounded-full border border-amber-200/30 sm:h-8 sm:w-8"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="max-w-[7rem] truncate text-xs text-amber-100/80 sm:max-w-[10rem] sm:text-sm">
        {player.isGuest ? `${player.name} · conv.` : player.name}
      </span>
      <button
        type="button"
        onClick={() => {
          if (player.isGuest) void player.exitGuest();
          else void signOut();
        }}
        className="text-[0.65rem] uppercase tracking-wider text-emerald-200/50 hover:text-amber-200 sm:text-xs"
      >
        Sair
      </button>
    </div>
  );
}
