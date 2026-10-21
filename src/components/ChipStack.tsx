"use client";

import type { CSSProperties } from "react";

/**
 * Felt & Clay — premium clay poker chips.
 * Edge stripes + face denom + stacked depth. Used for pot & seat bets.
 */

type ChipTone = {
  value: number;
  /** CSS custom props set on .fc-chip */
  body: string;
  stripe: string;
  face: string;
  ink: string;
  short: string;
};

const DENOMS: ChipTone[] = [
  {
    value: 500,
    body: "#5c3d2e",
    stripe: "#e8d5b5",
    face: "#3d281c",
    ink: "#f3e6d0",
    short: "5C",
  },
  {
    value: 100,
    body: "#1c1c1e",
    stripe: "#f0ebe3",
    face: "#0e0e10",
    ink: "#f5f0e8",
    short: "100",
  },
  {
    value: 25,
    body: "#1f5c3a",
    stripe: "#d4e8d8",
    face: "#143d26",
    ink: "#e8f5ec",
    short: "25",
  },
  {
    value: 10,
    body: "#1e3a5f",
    stripe: "#c5d8f0",
    face: "#132840",
    ink: "#e8f0fa",
    short: "10",
  },
  {
    value: 5,
    body: "#8b2e2e",
    stripe: "#f0d4d0",
    face: "#5c1e1e",
    ink: "#fceceb",
    short: "5",
  },
  {
    value: 1,
    body: "#c4b49a",
    stripe: "#5a4a38",
    face: "#ebe0cc",
    ink: "#3a2e22",
    short: "1",
  },
];

function breakChips(amount: number): { tone: ChipTone; n: number }[] {
  let left = Math.max(0, Math.floor(amount));
  const out: { tone: ChipTone; n: number }[] = [];
  for (const tone of DENOMS) {
    if (left < tone.value) continue;
    const n = Math.min(7, Math.floor(left / tone.value));
    if (n > 0) {
      out.push({ tone, n });
      left -= n * tone.value;
    }
  }
  if (left > 0) {
    const ones = out.find((x) => x.tone.value === 1);
    if (ones) ones.n = Math.min(7, ones.n + left);
    else out.push({ tone: DENOMS[DENOMS.length - 1], n: Math.min(7, left) });
  }
  return out;
}

function formatAmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
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

export function ChipStack({
  amount,
  size = "md",
  label,
}: {
  amount: number;
  size?: "sm" | "md" | "lg";
  /** Override amount label (e.g. "Pote") */
  label?: string;
}) {
  if (amount <= 0) return null;
  const stacks = breakChips(amount);
  const step = size === "lg" ? 4 : size === "sm" ? 2.5 : 3.25;
  const gap = size === "lg" ? "gap-1.5" : "gap-1";

  return (
    <div className="fc-chip-stack" title={`${amount} fichas`}>
      <div className={`flex items-end ${gap}`}>
        {stacks.map(({ tone, n }) => (
          <div
            key={tone.value}
            className="relative flex flex-col-reverse items-center"
            style={{ height: `${n * step + (size === "lg" ? 22 : size === "sm" ? 12 : 16)}px` }}
          >
            {Array.from({ length: n }).map((_, i) => (
              <span
                key={i}
                className="fc-chip-stack__unit"
                style={{
                  marginBottom: i === 0 ? 0 : -step * 0.55,
                  zIndex: n - i,
                }}
              >
                <PokerChip tone={tone} size={size} showFace={i === n - 1} />
              </span>
            ))}
          </div>
        ))}
      </div>
      <span className={`fc-chip-stack__label ${size === "lg" ? "fc-chip-stack__label--lg" : ""}`}>
        {label ?? formatAmt(amount)}
      </span>
    </div>
  );
}

/** Decorative chip row for lobby hero (Felt & Clay). */
export function ChipShowcase({ className = "" }: { className?: string }) {
  return (
    <div className={`fc-chip-showcase ${className}`} aria-hidden>
      {[DENOMS[4], DENOMS[3], DENOMS[2], DENOMS[1]].map((tone, i) => (
        <span
          key={tone.value}
          className="fc-chip-showcase__item"
          style={{ transform: `translateY(${(i % 2) * 6}px) rotate(${-8 + i * 5}deg)` }}
        >
          <PokerChip tone={tone} size="lg" showFace />
        </span>
      ))}
    </div>
  );
}

/** Offset chip bet toward table center from a seat. */
export function seatBetOffset(seat: number): { top: string; left: string } {
  const inward: { top: string; left: string }[] = [
    { top: "72%", left: "50%" },
    { top: "62%", left: "72%" },
    { top: "48%", left: "78%" },
    { top: "32%", left: "72%" },
    { top: "24%", left: "50%" },
    { top: "32%", left: "28%" },
    { top: "48%", left: "22%" },
    { top: "62%", left: "28%" },
    { top: "74%", left: "62%" },
    { top: "74%", left: "38%" },
  ];
  return inward[seat] ?? { top: "50%", left: "50%" };
}
