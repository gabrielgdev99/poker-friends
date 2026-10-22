import { isRed, cardLabel } from "@/lib/poker/cards";
import type { Card } from "@/lib/types";

export type CardSize = "seat" | "board" | "hero";

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
  const dealStyle =
    dealDelayMs != null ? { animationDelay: `${dealDelayMs}ms` } : undefined;
  const dealClass = dealDelayMs != null ? "card-deal" : "";

  if (hidden || !card) {
    return (
      <div
        className={`playing-card playing-card--${resolved} playing-card--back ${dealClass}`}
        style={dealStyle}
        aria-label="Carta fechada"
      />
    );
  }

  const red = isRed(card);
  const suit = { s: "♠", h: "♥", d: "♦", c: "♣" }[card.suit];
  const rank = card.rank === "T" ? "10" : card.rank;

  return (
    <div
      className={`playing-card playing-card--${resolved} ${dealClass} ${red ? "playing-card--red" : ""}`}
      style={dealStyle}
      aria-label={cardLabel(card)}
    >
      <span className="playing-card__idx">
        {rank}
        <span>{suit}</span>
      </span>
      {resolved === "hero" && (
        <>
          <span className="playing-card__pip" aria-hidden>
            {suit}
          </span>
          <span className="playing-card__idx playing-card__idx--rev" aria-hidden>
            {rank}
            <span>{suit}</span>
          </span>
        </>
      )}
    </div>
  );
}
