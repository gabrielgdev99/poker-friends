"use client";

/** Classic chip denominations (high → low). */
const DENOMS = [
  { value: 500, color: "#c026d3", ring: "#f0abfc", label: "500" },
  { value: 100, color: "#111827", ring: "#f9fafb", label: "100" },
  { value: 25, color: "#16a34a", ring: "#bbf7d0", label: "25" },
  { value: 10, color: "#2563eb", ring: "#bfdbfe", label: "10" },
  { value: 5, color: "#dc2626", ring: "#fecaca", label: "5" },
  { value: 1, color: "#e8e0d0", ring: "#78716c", label: "1" },
] as const;

function breakChips(amount: number): { value: number; color: string; ring: string; n: number }[] {
  let left = Math.max(0, Math.floor(amount));
  const out: { value: number; color: string; ring: string; n: number }[] = [];
  for (const d of DENOMS) {
    if (left < d.value) continue;
    const n = Math.min(8, Math.floor(left / d.value)); // cap stack height per color
    if (n > 0) {
      out.push({ value: d.value, color: d.color, ring: d.ring, n });
      left -= n * d.value;
    }
  }
  // remainder as 1s if any
  if (left > 0) {
    const ones = out.find((x) => x.value === 1);
    if (ones) ones.n = Math.min(8, ones.n + left);
    else out.push({ value: 1, color: "#e8e0d0", ring: "#78716c", n: Math.min(8, left) });
  }
  return out;
}

function formatAmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
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
  const chip =
    size === "lg" ? "h-4 w-4 sm:h-5 sm:w-5" : size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3 sm:h-3.5 sm:w-3.5";
  const gap = size === "lg" ? "gap-1" : "gap-0.5";

  return (
    <div className="flex flex-col items-center gap-0.5" title={`${amount} fichas`}>
      <div className={`flex items-end ${gap}`}>
        {stacks.map((s) => (
          <div
            key={s.value}
            className="relative flex flex-col-reverse items-center"
            style={{ height: `${Math.max(s.n, 1) * (size === "lg" ? 5 : size === "sm" ? 3 : 4) + 4}px` }}
          >
            {Array.from({ length: s.n }).map((_, i) => (
              <span
                key={i}
                className={`${chip} rounded-full border shadow-sm`}
                style={{
                  background: s.color,
                  borderColor: s.ring,
                  marginBottom: i === 0 ? 0 : size === "sm" ? -1.5 : -2,
                  zIndex: s.n - i,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <span
        className={`rounded-full bg-black/55 px-1.5 font-semibold tabular-nums text-amber-100 ${
          size === "lg" ? "text-xs sm:text-sm" : "text-[0.6rem] sm:text-[0.65rem]"
        }`}
      >
        {label ?? formatAmt(amount)}
      </span>
    </div>
  );
}

/** Offset chip bet toward table center from a seat. */
export function seatBetOffset(seat: number): { top: string; left: string } {
  // Seat indices match SEAT_POS oval; nudge inward
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
