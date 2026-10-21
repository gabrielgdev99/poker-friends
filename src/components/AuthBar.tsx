"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePlayer } from "@/components/PlayerProvider";

/** Home: Campeões only when logged out (CTAs live in HomeClient). Table: compact. */
export function AuthBar({ compact }: { compact?: boolean }) {
  const player = usePlayer();

  if (player.mode === "loading") {
    return <p className="pf-kicker">…</p>;
  }

  if (player.mode === "none") {
    return (
      <Link href="/campeoes" className="pf-navlink">
        Campeões
      </Link>
    );
  }

  return (
    <div className="pf-row" style={{ flexWrap: "wrap", justifyContent: "flex-end", gap: "0.5rem" }}>
      {!compact && (
        <Link href="/campeoes" className="pf-navlink">
          Campeões
        </Link>
      )}
      {player.isAdmin && !compact && (
        <Link href="/admin" className="pf-navlink" style={{ color: "var(--fc-wax)" }}>
          Admin
        </Link>
      )}
      {player.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.image}
          alt=""
          className="pf-avatar"
          referrerPolicy="no-referrer"
        />
      )}
      <span className={compact ? "pf-name pf-name--tight" : "pf-name"}>{player.name}</span>
      {!compact && (
        <button
          type="button"
          onClick={() => {
            if (player.isGuest) void player.exitGuest();
            else void signOut();
          }}
          className="pf-navlink"
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--fc-ink-mute)" }}
        >
          Sair
        </button>
      )}
    </div>
  );
}
