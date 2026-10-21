"use client";

import type { CSSProperties } from "react";
import { betRingPositions } from "@/lib/poker/seat-layout";

/** Compact chip text. Big stacks stay short so the pile never grows with the amount. */
export function formatChips(n: number) {
  const v = Math.max(0, Math.floor(n));
  if (v >= 10_000) {
    const k = v / 1000;
    const s =
      k >= 100 ? String(Math.round(k)) : Number.isInteger(k) ? String(k) : k.toFixed(1);
    return `${s}k`;
  }
  return v.toLocaleString("pt-BR");
}

/**
 * Felt & Clay — classic casino chips (red / blue / green / black).
 * Edge spots + face denom + stacked depth. Shared by pot, seat bets, lobby.
 */

type ChipTone = {
  value: number;
  body: string;
  stripe: string;
  face: string;
  ink: string;
  short: string;
};

/** Classic casino ladder — no brown blobs. */
const DENOMS: ChipTone[] = [
  {
    value: 500,
    body: "#6b21a8",
    stripe: "#f5f0ff",
    face: "#581c87",
    ink: "#faf5ff",
    short: "500",
  },
  {
    value: 100,
    body: "#171717",
    stripe: "#fafafa",
    face: "#0a0a0a",
    ink: "#fafafa",
    short: "100",
  },
  {
    value: 25,
    body: "#15803d",
    stripe: "#f0fdf4",
    face: "#14532d",
    ink: "#f0fdf4",
    short: "25",
  },
  {
    value: 10,
    body: "#1d4ed8",
    stripe: "#eff6ff",
    face: "#1e3a8a",
    ink: "#eff6ff",
    short: "10",
  },
  {
    value: 5,
    body: "#dc2626",
    stripe: "#fef2f2",
    face: "#991b1b",
    ink: "#fef2f2",
    short: "5",
  },
  {
    value: 1,
    body: "#e7e5e4",
    stripe: "#292524",
    face: "#fafaf9",
    ink: "#1c1917",
    short: "1",
  },
];

function breakChips(amount: number): { tone: ChipTone; n: number }[] {
  let left = Math.max(0, Math.floor(amount));
  const out: { tone: ChipTone; n: number }[] = [];
  for (const tone of DENOMS) {
    if (left < tone.value) continue;
    const n = Math.min(6, Math.floor(left / tone.value));
    if (n > 0) {
      out.push({ tone, n });
      left -= n * tone.value;
    }
  }
  if (left > 0) {
    const ones = out.find((x) => x.tone.value === 1);
    if (ones) ones.n = Math.min(6, ones.n + left);
    else out.push({ tone: DENOMS[DENOMS.length - 1], n: Math.min(6, left) });
  }
  return out;
}

function PokerChip({
  tone,
  size,
  showFace,
}: {
  tone: ChipTone;
  size: "sm" | "md" | "lg";
  showFace: boolean;
}) {
  const dim =
    size === "lg" ? "fc-chip--lg" : size === "sm" ? "fc-chip--sm" : "fc-chip--md";
  return (
    <span
      className={`fc-chip ${dim}`}
      style={
        {
          "--fc-chip-body": tone.body,
          "--fc-chip-stripe": tone.stripe,
          "--fc-chip-face": tone.face,
          "--fc-chip-ink": tone.ink,
        } as CSSProperties
      }
      aria-hidden
    >
      {showFace && <span className="fc-chip__face">{tone.short}</span>}
    </span>
  );
}

/**
 * One summarized pile + the real amount.
 * Columns and height are capped so 10.000+ cannot spill onto seats, the board, or the rail.
 */
function summarizedPile(amount: number, columns: number, maxHigh: number) {
  let left = Math.max(0, Math.floor(amount));
  const out: { tone: ChipTone; n: number }[] = [];
  for (const tone of DENOMS) {
    if (out.length >= columns || left <= 0) break;
    if (left < tone.value) continue;
    const n = Math.min(maxHigh, Math.floor(left / tone.value));
    if (n <= 0) continue;
    out.push({ tone, n });
    left -= n * tone.value;
  }
  if (out.length === 0) out.push({ tone: DENOMS[DENOMS.length - 1], n: 1 });
  return out;
}

export function ChipStack({
  amount,
  size = "md",
  label,
  layout = "stack",
}: {
  amount: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  /** bet: 1 column. pot: 2 columns. Both max 3 chips tall. */
  layout?: "bet" | "pot" | "stack";
}) {
  if (amount <= 0) return null;
  const columns = layout === "pot" ? 2 : 1;
  const maxHigh = 3;
  const stacks =
    layout === "stack" ? breakChips(amount).slice(0, 3).map((s) => ({ ...s, n: Math.min(3, s.n) })) : summarizedPile(amount, columns, maxHigh);
  const chipPx = layout === "pot" ? 16 : 14;
  const step = 3;

  return (
    <div
      className={`fc-chip-stack fc-chip-stack--${layout}`}
      title={`${amount} fichas`}
    >
      <div className="fc-chip-stack__pile" aria-hidden>
        {stacks.map(({ tone, n }) => (
          <span
            key={tone.value}
            className="fc-chip-stack__col"
            style={{ width: chipPx, height: chipPx + (n - 1) * step }}
          >
            {Array.from({ length: n }).map((_, i) => (
              <span
                key={i}
                className="fc-chip-stack__unit"
                style={{ bottom: i * step, zIndex: i + 1 }}
              >
                <PokerChip tone={tone} size={size === "lg" ? "md" : size} showFace={i === n - 1 && layout === "pot"} />
              </span>
            ))}
          </span>
        ))}
      </div>
      <span className="fc-chip-stack__label">{label ?? formatChips(amount)}</span>
    </div>
  );
}

/** Lobby hero — same casino chips as the table. */
export function ChipShowcase({ className = "" }: { className?: string }) {
  return (
    <div className={`fc-chip-showcase ${className}`} aria-hidden>
      {[DENOMS[4], DENOMS[3], DENOMS[2], DENOMS[1]].map((tone, i) => (
        <span
          key={tone.value}
          className="fc-chip-showcase__item"
          style={{
            transform: `translateY(${(i % 2) * 6}px) rotate(${-8 + i * 5}deg)`,
          }}
        >
          <PokerChip tone={tone} size="lg" showFace />
        </span>
      ))}
    </div>
  );
}

export function seatBetOffset(
  seat: number,
  maxSeats = 10,
  heroSeat: number | null = null,
): { top: string; left: string } {
  return betRingPositions(maxSeats, heroSeat)[seat] ?? { top: "50%", left: "50%" };
}
