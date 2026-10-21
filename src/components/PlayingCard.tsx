import { isRed, cardLabel } from "@/lib/poker/cards";
import type { Card } from "@/lib/types";

export function PlayingCard({
  card,
  hidden,
  compact,
}: {
  card?: Card | null;
  hidden?: boolean;
  compact?: boolean;
}) {
  const size = compact
    ? "h-12 w-9 text-[0.65rem]"
    : "h-16 w-11 sm:h-20 sm:w-14 text-sm sm:text-base";

  if (hidden || !card) {
    return (
      <div
        className={`${size} rounded-md border border-amber-900/40 bg-[linear-gradient(145deg,#1a3a2a_0%,#0d2218_50%,#1f4a32_100%)] shadow-md shadow-black/40`}
        aria-label="Carta fechada"
      >
        <div className="flex h-full items-center justify-center">
          <span className="font-[family-name:var(--font-display)] text-amber-500/50 text-lg">
            ♠
          </span>
        </div>
      </div>
    );
  }

  const red = isRed(card);
  return (
    <div
      className={`${size} flex flex-col justify-between rounded-md border border-stone-300/80 bg-[#f7f3ea] p-1 shadow-md shadow-black/30`}
      aria-label={cardLabel(card)}
    >
      <span
        className={`font-semibold leading-none ${red ? "text-rose-700" : "text-stone-900"}`}
      >
        {card.rank === "T" ? "10" : card.rank}
        <span className="ml-0.5">
          {{ s: "♠", h: "♥", d: "♦", c: "♣" }[card.suit]}
        </span>
      </span>
      <span
        className={`self-end text-lg leading-none ${red ? "text-rose-700" : "text-stone-900"}`}
      >
        {{ s: "♠", h: "♥", d: "♦", c: "♣" }[card.suit]}
      </span>
    </div>
  );
}
