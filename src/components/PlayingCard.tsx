import { isRed, cardLabel } from "@/lib/poker/cards";
import type { Card } from "@/lib/types";

export type CardSize = "seat" | "board" | "hero";

const SIZE: Record<CardSize, string> = {
  /** Opponent / seat hole cards */
  seat: "h-12 w-[2.15rem] text-[0.7rem] sm:h-14 sm:w-10 sm:text-[0.8rem]",
  /** Community board */
  board: "h-[4.25rem] w-[3rem] text-sm sm:h-24 sm:w-[4.25rem] sm:text-lg",
  /** Viewer's own hole (largest) */
  hero: "h-[4.5rem] w-[3.2rem] text-sm sm:h-28 sm:w-20 sm:text-xl",
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
      ? "text-2xl sm:text-3xl"
      : resolved === "board"
        ? "text-xl sm:text-2xl"
        : "text-base sm:text-lg";

  if (hidden || !card) {
    return (
      <div
        className={`${box} ${dealClass} rounded-md border border-amber-900/40 bg-[linear-gradient(145deg,#1a3a2a_0%,#0d2218_50%,#1f4a32_100%)] shadow-md shadow-black/40`}
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
  return (
    <div
      className={`${box} ${dealClass} flex flex-col justify-between rounded-md border border-stone-300/80 bg-[#f7f3ea] p-1 shadow-md shadow-black/30 sm:p-1.5`}
      style={dealStyle}
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
        className={`self-end leading-none ${pip} ${red ? "text-rose-700" : "text-stone-900"}`}
      >
        {{ s: "♠", h: "♥", d: "♦", c: "♣" }[card.suit]}
      </span>
    </div>
  );
}
