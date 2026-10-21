/**
 * Visual seat ring. Game seat indexes stay as-is.
 * The hero seat is rotated to bottom-center. Indexes increase clockwise
 * on screen (CSS y grows downward). Bets sit on the same ray, closer to
 * the middle, outside the community-card well.
 */

export type SeatPoint = { top: string; left: string };

function ring(
  count: number,
  heroSeat: number | null,
  rx: number,
  ry: number,
): SeatPoint[] {
  const n = Math.min(10, Math.max(2, count));
  const hero =
    heroSeat == null || !Number.isFinite(heroSeat)
      ? 0
      : ((Math.floor(heroSeat) % n) + n) % n;
  const out: SeatPoint[] = [];
  for (let seat = 0; seat < n; seat++) {
    const visual = (seat - hero + n) % n;
    // 90° is bottom in CSS. Increasing degrees run clockwise.
    const rad = ((90 + (visual * 360) / n) * Math.PI) / 180;
    out.push({
      left: `${50 + rx * Math.cos(rad)}%`,
      top: `${50 + ry * Math.sin(rad)}%`,
    });
  }
  return out;
}

/** Same ellipse shape so a bet sits on the ray from its seat to the center. */
function radii(count: number, kind: "seat" | "bet") {
  const n = Math.min(10, Math.max(2, count));
  // Seats sit near the edge; bets stay on the same ellipse, clear of both the seat and the board.
  const rx = 42;
  const ry = 40;
  if (kind === "seat") return { rx, ry };
  const betRx = n >= 8 ? 22 : 21;
  return { rx: betRx, ry: betRx * (ry / rx) };
}

/** Seats outside the rail. Seat 0 is bottom when heroSeat is null. */
export function seatRingPositions(
  count: number,
  heroSeat: number | null = null,
): SeatPoint[] {
  const { rx, ry } = radii(count, "seat");
  return ring(count, heroSeat, rx, ry);
}

/** Bets between the seat and the board. Same rotation as the seats. */
export function betRingPositions(
  count: number,
  heroSeat: number | null = null,
): SeatPoint[] {
  const { rx, ry } = radii(count, "bet");
  return ring(count, heroSeat, rx, ry);
}

/** Dev check: hero at the bottom, bets inside the seat ring on the same ray. */
export function seatLayoutSelfCheck(): void {
  const two = seatRingPositions(2, 0);
  const heroTop = parseFloat(two[0].top);
  const oppTop = parseFloat(two[1].top);
  if (!(heroTop > oppTop)) {
    throw new Error(`hero not below opponent: ${heroTop} vs ${oppTop}`);
  }
  if (Math.abs(parseFloat(two[0].left) - 50) > 0.02) {
    throw new Error("hero not horizontally centered");
  }

  const six = seatRingPositions(6, 3);
  const bets = betRingPositions(6, 3);
  const tops = six.map((p) => parseFloat(p.top));
  if (tops[3] !== Math.max(...tops)) {
    throw new Error("rotated hero is not the bottom seat");
  }
  for (let i = 0; i < six.length; i++) {
    const sx = parseFloat(six[i].left) - 50;
    const sy = parseFloat(six[i].top) - 50;
    const bx = parseFloat(bets[i].left) - 50;
    const by = parseFloat(bets[i].top) - 50;
    const seatR = Math.hypot(sx, sy);
    const betR = Math.hypot(bx, by);
    if (!(betR < seatR - 4)) throw new Error(`bet ${i} not inside seat ring`);
    const cross = sx * by - sy * bx;
    if (Math.abs(cross) > 0.05) throw new Error(`bet ${i} not on the seat ray (${cross})`);
  }
}
