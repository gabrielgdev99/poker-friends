/**
 * Poker-client style seating: even angles around an ellipse.
 * Seat 0 = bottom (hero slot). Indices increase clockwise.
 * Radii leave margin so compact pods don't overlap or clip.
 */

export type SeatPoint = { top: string; left: string };

/** Evenly spaced seats; seat 0 at bottom center. */
export function seatRingPositions(count: number): SeatPoint[] {
  const n = Math.min(10, Math.max(2, count));
  // Slightly flat ellipse — classic HTML5 poker feel
  const rx = n <= 6 ? 40 : 41;
  const ry = n <= 6 ? 36 : 37;
  const out: SeatPoint[] = [];
  for (let i = 0; i < n; i++) {
    // -90° = bottom; clockwise
    const deg = -90 + (i * 360) / n;
    const rad = (deg * Math.PI) / 180;
    out.push({
      left: `${50 + rx * Math.cos(rad)}%`,
      top: `${50 + ry * Math.sin(rad)}%`,
    });
  }
  return out;
}

/** Bet chip stacks between seat and table center. */
export function betRingPositions(count: number): SeatPoint[] {
  const n = Math.min(10, Math.max(2, count));
  const rx = n <= 6 ? 26 : 27;
  const ry = n <= 6 ? 24 : 25;
  const out: SeatPoint[] = [];
  for (let i = 0; i < n; i++) {
    const deg = -90 + (i * 360) / n;
    const rad = (deg * Math.PI) / 180;
    out.push({
      left: `${50 + rx * Math.cos(rad)}%`,
      top: `${50 + ry * Math.sin(rad)}%`,
    });
  }
  return out;
}
