"use client";

import type { CSSProperties } from "react";
import { formatChips } from "@/components/ChipStack";
import { PlayingCard } from "@/components/PlayingCard";
import type { BotDifficulty, Card, PublicRoom } from "@/lib/types";

const BOT_SHORT: Record<BotDifficulty, string> = {
  easy: "Ini",
  medium: "Méd",
  hard: "Dif",
};

type PublicPlayer = PublicRoom["players"][number];

/** Seat on the ring: avatar, name, stack, blinds. Bets are rendered separately. */
export function CompactSeat({
  player,
  empty,
  canSit,
  pending,
  isMe,
  isActing,
  folded,
  isDealer,
  isSb,
  isBb,
  timerLeft,
  timerPct,
  bubble,
  showCards,
  onSit,
  style,
}: {
  player?: PublicPlayer;
  empty: boolean;
  canSit: boolean;
  pending: boolean;
  isMe: boolean;
  isActing: boolean;
  folded: boolean;
  isDealer: boolean;
  isSb: boolean;
  isBb: boolean;
  timerLeft?: number;
  timerPct?: number;
  bubble?: { id: string; text: string; kind: "text" | "emoji" } | null;
  showCards: boolean;
  onSit: () => void;
  style?: CSSProperties;
}) {
  const pct = Math.max(0, Math.min(100, timerPct ?? 0));
  const name = player
    ? `${isMe ? "Você" : player.nickname}${
        player.isBot && player.botDifficulty ? ` · ${BOT_SHORT[player.botDifficulty]}` : ""
      }`
    : "";

  return (
    <button
      type="button"
      disabled={!empty || !canSit || pending}
      onClick={onSit}
      className={`seat ${empty && canSit ? "seat--sit" : ""}`}
      style={style}
    >
      {bubble && !folded && !empty && (
        <div key={bubble.id} className="seat-chat-bubble">
          <div
            className={`seat-chat-bubble__body ${
              bubble.kind === "emoji" ? "seat-chat-bubble__body--emoji" : ""
            }`}
          >
            <span className="line-clamp-2 break-words">{bubble.text}</span>
          </div>
        </div>
      )}

      {empty ? (
        <span className={`seat-empty ${canSit ? "seat-empty--open" : ""}`}>
          {canSit ? "Sentar" : <span className="seat-empty__dot" />}
        </span>
      ) : (
        player && (
          <span className={`seat-body ${folded ? "seat-folded" : ""}`}>
            <span
              className={`seat-ring ${isActing ? "seat-ring--acting seat-your-turn" : ""}`}
              style={
                isActing
                  ? {
                      background: `conic-gradient(#f5c84a ${pct}%, rgba(255,255,255,0.16) ${pct}%)`,
                    }
                  : undefined
              }
            >
              <span
                className="seat-avatar"
                style={
                  folded
                    ? undefined
                    : { boxShadow: `inset 0 0 0 1.5px ${player.chipColor || "#e8b84a"}` }
                }
              >
                {player.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span aria-hidden>{player.emoji || "🙏"}</span>
                )}
              </span>
            </span>

            <span className={`seat-plate ${isActing ? "seat-plate--acting" : ""} ${isMe ? "seat-plate--me" : ""}`}>
              <span className="seat-plate__row">
                <span className="seat-name">{name}</span>
                {(isDealer || isSb || isBb) && (
                  <span className="seat-badges">
                    {isDealer && <span className="seat-badge seat-badge--d">D</span>}
                    {isSb && <span className="seat-badge seat-badge--sb">SB</span>}
                    {isBb && <span className="seat-badge seat-badge--bb">BB</span>}
                  </span>
                )}
              </span>
              <span
                className="seat-stack"
                style={
                  folded || isActing ? undefined : { color: player.chipColor || "#f0b429" }
                }
              >
                {formatChips(player.chips)}
                {isActing && timerLeft != null ? ` · ${timerLeft}s` : ""}
              </span>
              {folded && <span className="seat-flag">Fold</span>}
              {player.allIn && !folded && <span className="seat-flag">All-in</span>}
            </span>

            {showCards && (
              <span className={`seat-holes ${folded ? "opacity-40 grayscale" : ""}`}>
                {player.hole ? (
                  player.hole.map((c: Card, i: number) => (
                    <PlayingCard key={i} card={c} size="seat" />
                  ))
                ) : (
                  <>
                    <PlayingCard hidden size="seat" />
                    <PlayingCard hidden size="seat" />
                  </>
                )}
              </span>
            )}
          </span>
        )
      )}
    </button>
  );
}
