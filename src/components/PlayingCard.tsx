import { isRed, cardLabel } from "@/lib/poker/cards";
import type { Card } from "@/lib/types";

export type CardSize = "seat" | "board" | "hero";

/** Real poker card ratio ≈ 2.5 : 3.5 (width : height). Width-driven + aspect. */
const SIZE: Record<CardSize, string> = {
  seat: "w-[1.85rem] sm:w-9 aspect-[2.5/3.5] text-[0.65rem] sm:text-[0.75rem]",
  board: "w-[2.75rem] sm:w-[3.75rem] aspect-[2.5/3.5] text-xs sm:text-base",
  hero: "w-[3.25rem] sm:w-[4.25rem] aspect-[2.5/3.5] text-sm sm:text-base",
};

export function PlayingCard({
  card,
  hidden,
  compact,
  size = "seat",
  dealDelayMs,
}: {
  card?: Card | null;
  hidden?: boolean;
  /** @deprecated use size="seat" */
  compact?: boolean;
  size?: CardSize;
  dealDelayMs?: number;
}) {
  const resolved: CardSize = compact && size === "seat" ? "seat" : size;
  const box = SIZE[resolved];
  const dealStyle =
    dealDelayMs != null ? { animationDelay: `${dealDelayMs}ms` } : undefined;
  const dealClass = dealDelayMs != null ? "card-deal" : "";
  const pip =
    resolved === "hero"
      ? "text-lg sm:text-2xl"
      : resolved === "board"
        ? "text-base sm:text-xl"
        : "text-sm sm:text-base";

  if (hidden || !card) {
    return (
      <div
        className={`${box} ${dealClass} shrink-0 rounded-[0.35rem] border border-amber-900/40 bg-[linear-gradient(145deg,#1a3a2a_0%,#0d2218_50%,#1f4a32_100%)] shadow-md shadow-black/40`}
        style={dealStyle}
        aria-label="Carta fechada"
      >
        <div className="flex h-full items-center justify-center">
          <span className={`font-[family-name:var(--font-display)] text-amber-500/50 ${pip}`}>
            ♠
          </span>
        </div>
      </div>
    );
  }

  const red = isRed(card);
  const suit = { s: "♠", h: "♥", d: "♦", c: "♣" }[card.suit];
  const rank = card.rank === "T" ? "10" : card.rank;

  return (
    <div
      className={`${box} ${dealClass} flex shrink-0 flex-col justify-between rounded-[0.35rem] border border-stone-300/80 bg-[#f7f3ea] p-0.5 shadow-md shadow-black/30 sm:p-1`}
      style={dealStyle}
      aria-label={cardLabel(card)}
    >
      <span
        className={`font-semibold leading-none ${red ? "text-rose-700" : "text-stone-900"}`}
      >
        {rank}
        <span className="ml-px">{suit}</span>
      </span>
      <span
        className={`self-end leading-none ${pip} ${red ? "text-rose-700" : "text-stone-900"}`}
      >
        {suit}
      </span>
    </div>
  );
}
