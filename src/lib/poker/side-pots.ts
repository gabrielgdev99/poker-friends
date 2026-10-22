/** One player’s chips in the current hand. Folded players pay in but cannot win. */
export type PotShare = {
  seat: number;
  contributed: number;
  folded: boolean;
  score: number[];
  handName: string;
};

export type PotWin = { seat: number; amount: number; handName: string };

function better(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Main pot + side pots. A player only wins chips up to what they put in.
 * A layer with a single eligible player is an uncalled bet and goes back to them.
 */
function addWin(totals: Map<number, PotWin>, winners: PotShare[], amount: number) {
  const share = Math.floor(amount / winners.length);
  let rem = amount - share * winners.length;
  for (const w of winners) {
    const extra = rem > 0 ? 1 : 0;
    rem -= extra;
    const add = share + extra;
    const cur = totals.get(w.seat) ?? { seat: w.seat, amount: 0, handName: w.handName };
    cur.amount += add;
    cur.handName = w.handName || cur.handName;
    totals.set(w.seat, cur);
  }
}

export function splitPots(players: PotShare[]): PotWin[] {
  // Leavers keep seat -1. Their chips still fill the layers; they just can't win.
  const paying = players.filter((p) => p.contributed > 0);
  const levels = [...new Set(paying.map((p) => p.contributed))].sort((a, b) => a - b);
  const totals = new Map<number, PotWin>();
  let prev = 0;
  let orphan = 0;
  let lastWinners: PotShare[] = [];

  for (const level of levels) {
    let amount = 0;
    for (const p of paying) {
      amount += Math.max(0, Math.min(p.contributed, level) - Math.min(p.contributed, prev));
    }
    const eligible = paying.filter(
      (p) => p.seat >= 0 && !p.folded && p.contributed >= level && p.score.length > 0,
    );
    prev = level;
    if (amount <= 0) continue;
    if (eligible.length === 0) {
      orphan += amount;
      continue;
    }

    amount += orphan;
    orphan = 0;
    const ranked = [...eligible].sort((a, b) => better(b.score, a.score) || a.seat - b.seat);
    const best = ranked[0].score;
    const winners = ranked.filter((p) => better(p.score, best) === 0);
    lastWinners = winners;
    addWin(totals, winners, amount);
  }

  // Chips above every live stack (a folded leaver who put in more) stay in the last pot.
  if (orphan > 0 && lastWinners.length > 0) addWin(totals, lastWinners, orphan);

  return [...totals.values()].filter((w) => w.amount > 0);
}
