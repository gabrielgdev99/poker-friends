import { RANK_VALUE } from "@/lib/poker/cards";
import type { Card, Rank } from "@/lib/types";

export type HandRank = {
  score: number[]; // lexicographic compare
  name: string;
};

function combinations(cards: Card[], k: number): Card[][] {
  const out: Card[][] = [];
  const n = cards.length;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    out.push(idx.map((i) => cards[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

function rankFive(cards: Card[]): HandRank {
  const vals = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const flush = suits.every((s) => s === suits[0]);

  // wheel
  let straightHigh = 0;
  const uniq = [...new Set(vals)].sort((a, b) => b - a);
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) {
      straightHigh = 5;
    }
  }

  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const pattern = groups.map((g) => g[1]);

  if (flush && straightHigh) {
    return {
      score: [8, straightHigh],
      name: straightHigh === 14 ? "Royal Flush" : "Straight Flush",
    };
  }
  if (pattern[0] === 4) {
    return { score: [7, groups[0][0], groups[1][0]], name: "Quadra" };
  }
  if (pattern[0] === 3 && pattern[1] === 2) {
    return { score: [6, groups[0][0], groups[1][0]], name: "Full House" };
  }
  if (flush) {
    return { score: [5, ...vals], name: "Flush" };
  }
  if (straightHigh) {
    return { score: [4, straightHigh], name: "Straight" };
  }
  if (pattern[0] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return { score: [3, groups[0][0], ...kickers], name: "Trinca" };
  }
  if (pattern[0] === 2 && pattern[1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2][0];
    return { score: [2, highPair, lowPair, kicker], name: "Dois Pares" };
  }
  if (pattern[0] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return { score: [1, groups[0][0], ...kickers], name: "Par" };
  }
  return { score: [0, ...vals], name: "Carta Alta" };
}

function cmpScore(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function bestHand(hole: Card[], community: Card[]): HandRank {
  const all = [...hole, ...community];
  if (all.length < 5) {
    const vals = all.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
    return { score: [0, ...vals], name: "Carta Alta" };
  }
  let best: HandRank | null = null;
  for (const five of combinations(all, 5)) {
    const h = rankFive(five);
    if (!best || cmpScore(h.score, best.score) > 0) best = h;
  }
  return best!;
}

export function compareHands(a: HandRank, b: HandRank): number {
  return cmpScore(a.score, b.score);
}

export function rankName(rank: Rank): string {
  return rank === "T" ? "10" : rank;
}
