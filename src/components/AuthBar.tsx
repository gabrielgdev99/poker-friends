"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePlayer } from "@/components/PlayerProvider";

/** Home: no Google button (CTAs live in HomeClient). Table: compact identity. */
export function AuthBar({ compact }: { compact?: boolean }) {
  const player = usePlayer();

  if (player.mode === "loading") {
    return (
      <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/40">…</p>
    );
  }

  if (player.mode === "none") {
    return (
      <Link
        href="/campeoes"
        className="text-[0.65rem] uppercase tracking-wider text-amber-200/70 hover:text-amber-300 sm:text-xs"
      >
        Campeões
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      {!compact && (
        <Link
          href="/campeoes"
          className="text-[0.65rem] uppercase tracking-wider text-amber-200/70 hover:text-amber-300 sm:text-xs"
        >
          Campeões
        </Link>
      )}
      {player.bankBalance != null && (
        <span className="tabular-nums text-[0.65rem] text-amber-300/90 sm:text-xs">
          🪙 {player.bankBalance.toLocaleString("pt-BR")}
          {player.isGuest ? " local" : ""}
        </span>
      )}
      {player.isAdmin && !compact && (
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
          className="h-7 w-7 rounded-full border border-amber-200/30"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="max-w-[6rem] truncate text-xs text-amber-100/80 sm:max-w-[9rem]">
        {player.isGuest ? `${player.name}` : player.name}
      </span>
      {!compact && (
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
      )}
    </div>
  );
}
