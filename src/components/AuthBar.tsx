"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePlayer } from "@/components/PlayerProvider";

/** Home: Campeões only when logged out (CTAs live in HomeClient). Table: compact. */
export function AuthBar({ compact }: { compact?: boolean }) {
  const player = usePlayer();

  if (player.mode === "loading") {
    return (
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--fc-ink-mute)]">…</p>
    );
  }

  if (player.mode === "none") {
    return (
      <Link
        href="/campeoes"
        className="text-[0.65rem] uppercase tracking-[0.16em] text-[var(--fc-clay-light)] hover:text-[var(--fc-wax)] sm:text-xs"
      >
        Campeões
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
      {!compact && (
        <Link
          href="/campeoes"
          className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--fc-clay-light)] hover:text-[var(--fc-wax)] sm:text-xs"
        >
          Campeões
        </Link>
      )}
      {player.isAdmin && !compact && (
        <Link
          href="/admin"
          className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--fc-wax)] hover:text-[var(--fc-wax-hot)] sm:text-xs"
        >
          Admin
        </Link>
      )}
      {player.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.image}
          alt=""
          className="h-7 w-7 rounded-full border border-white/15 object-cover"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="max-w-[4.2rem] truncate text-xs text-[var(--fc-ink)]/80 sm:max-w-[8rem]">
        {player.name}
      </span>
      {!compact && (
        <button
          type="button"
          onClick={() => {
            if (player.isGuest) void player.exitGuest();
            else void signOut();
          }}
          className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--fc-ink-mute)] hover:text-[var(--fc-ink)] sm:text-xs"
        >
          Sair
        </button>
      )}
    </div>
  );
}
