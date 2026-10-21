"use client";

import type { CSSProperties } from "react";
import { PlayingCard } from "@/components/PlayingCard";
import type { BotDifficulty, Card, PublicRoom } from "@/lib/types";

const BOT_SHORT: Record<BotDifficulty, string> = {
  easy: "Ini",
  medium: "Méd",
  hard: "Dif",
};

function formatChips(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

type PublicPlayer = PublicRoom["players"][number];

/** Compact opponent/hero seat — ClubGG-style: avatar + name/stack, tiny cards. */
export function CompactSeat({
  player,
  empty,
  seatIndex,
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
  lastLabel,
  bubble,
  showCards,
  onSit,
  style,
}: {
  player?: PublicPlayer;
  empty: boolean;
  seatIndex: number;
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
  lastLabel?: string | null;
  bubble?: { id: string; text: string; kind: "text" | "emoji" } | null;
  showCards: boolean;
  onSit: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      disabled={!empty || !canSit || pending}
      onClick={onSit}
      className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 ${
        empty && canSit ? "cursor-pointer" : "cursor-default"
      }`}
      style={{ width: "clamp(3.4rem, 13vw, 5rem)", ...style }}
    >
      {bubble && !folded && !empty && (
        <div
          key={bubble.id}
          className="seat-chat-bubble pointer-events-none absolute bottom-full left-1/2 z-30 mb-0.5 max-w-[6.5rem] -translate-x-1/2"
        >
          <div
            className={`rounded-xl bg-[#f7f3ea] px-2 py-0.5 text-[#1a1208] shadow-md ${
              bubble.kind === "emoji" ? "text-center text-lg" : "text-[0.6rem] leading-snug"
            }`}
          >
            <span className="line-clamp-2 break-words">{bubble.text}</span>
          </div>
        </div>
      )}

      {empty ? (
        <span className="flex h-8 items-center justify-center rounded-full border border-dashed border-emerald-300/25 bg-black/25 text-[0.6rem] text-emerald-100/45">
          {canSit ? `+${seatIndex + 1}` : "—"}
        </span>
      ) : (
        player && (
          <div
            className={`relative flex flex-col items-center gap-0.5 ${
              folded ? "seat-folded" : ""
            }`}
          >
            <div className="relative">
              <div
                className={`flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border sm:h-8 sm:w-8 ${
                  isActing
                    ? "border-amber-300 ring-2 ring-amber-400/60"
                    : "border-white/15"
                }`}
                style={
                  folded
                    ? undefined
                    : { boxShadow: `0 0 0 1px ${player.chipColor || "#f0b429"}66` }
                }
              >
                {player.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.avatarUrl}
                    alt=""
                    className={`h-full w-full object-cover ${folded ? "opacity-40" : ""}`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-sm sm:text-base" aria-hidden>
                    {player.emoji || "🙏"}
                  </span>
                )}
              </div>
              {isActing && timerLeft != null && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-1 text-[0.5rem] font-bold tabular-nums text-[#1a1208]">
                  {timerLeft}s
                </span>
              )}
              {isActing && timerPct != null && (
                <span
                  className="absolute inset-0 rounded-full ring-2 ring-amber-400/80"
                  style={{
                    opacity: 0.35 + (timerPct / 100) * 0.5,
                  }}
                />
              )}
              <div className="absolute -right-2 -top-1 flex flex-col gap-px">
                {isDealer && (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-100 text-[0.45rem] font-bold text-emerald-950">
                    D
                  </span>
                )}
                {isSb && (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-200 text-[0.4rem] font-bold text-emerald-950">
                    SB
                  </span>
                )}
                {isBb && (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-200 text-[0.4rem] font-bold text-emerald-950">
                    BB
                  </span>
                )}
              </div>
            </div>

            <div
              className={`w-full rounded-lg px-1 py-0.5 text-center ${
                isActing
                  ? "bg-amber-400 text-emerald-950"
                  : "bg-black/55 text-amber-50 backdrop-blur-sm"
              }`}
            >
              <p className="truncate text-[0.55rem] font-medium leading-tight sm:text-[0.65rem]">
                {isMe ? "Você" : player.nickname}
                {player.isBot && player.botDifficulty
                  ? ` · ${BOT_SHORT[player.botDifficulty]}`
                  : ""}
              </p>
              <p
                className="text-[0.65rem] font-semibold tabular-nums leading-tight sm:text-xs"
                style={
                  folded || isActing
                    ? undefined
                    : { color: player.chipColor || "#f0b429" }
                }
              >
                {formatChips(player.chips)}
              </p>
              {folded && (
                <p className="text-[0.5rem] font-semibold uppercase tracking-wide text-stone-500">
                  Fold
                </p>
              )}
              {player.allIn && !folded && (
                <p className="text-[0.5rem] font-medium">all-in</p>
              )}
              {lastLabel && !folded && !isActing && (
                <p className="truncate text-[0.5rem] text-amber-200/75">{lastLabel}</p>
              )}
            </div>

            {showCards && (
              <div
                className={`flex justify-center gap-px ${folded ? "opacity-40 grayscale" : ""}`}
              >
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
              </div>
            )}
          </div>
        )
      )}
    </button>
  );
}
