"use client";

import type { CSSProperties } from "react";

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
  label?: string;
}) {
  if (amount <= 0) return null;
  const stacks = breakChips(amount);
  // Vertical step between chips in a stack (px) — thicker = clearer 3D
  const step = size === "lg" ? 5 : size === "sm" ? 3.5 : 4.25;
  const baseH = size === "lg" ? 28 : size === "sm" ? 18 : 22;
  const gap = size === "lg" ? "gap-1.5" : "gap-1";

  return (
    <div className="fc-chip-stack" title={`${amount} fichas`}>
      <div className={`flex items-end ${gap}`}>
        {stacks.map(({ tone, n }) => (
          <div
            key={tone.value}
            className="relative flex flex-col-reverse items-center"
            style={{ height: `${(n - 1) * step + baseH}px` }}
          >
            {Array.from({ length: n }).map((_, i) => (
              <span
                key={i}
                className="fc-chip-stack__unit"
                style={{
                  marginBottom: i === 0 ? 0 : -(baseH - step),
                  zIndex: n - i,
                }}
              >
                <PokerChip tone={tone} size={size} showFace={i === n - 1} />
              </span>
            ))}
          </div>
        ))}
      </div>
      <span
        className={`fc-chip-stack__label ${size === "lg" ? "fc-chip-stack__label--lg" : ""}`}
      >
        {label ?? formatAmt(amount)}
      </span>
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
