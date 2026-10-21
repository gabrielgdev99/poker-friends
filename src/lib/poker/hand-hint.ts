import { RANK_VALUE } from "@/lib/poker/cards";
import { bestHand } from "@/lib/poker/hand-eval";
import type { Card, Rank } from "@/lib/types";

const RANK_PT: Record<number, string> = {
  14: "ás",
  13: "rei",
  12: "dama",
  11: "valete",
  10: "dez",
  9: "nove",
  8: "oito",
  7: "sete",
  6: "seis",
  5: "cinco",
  4: "quatro",
  3: "três",
  2: "dois",
};

function pluralRank(v: number): string {
  if (v === 14) return "ases";
  if (v === 13) return "reis";
  if (v === 12) return "damas";
  if (v === 11) return "valetes";
  return `${RANK_PT[v] ?? v}s`;
}

function rankLabel(rank: Rank): string {
  return RANK_PT[RANK_VALUE[rank]] ?? rank;
}

/** Player-facing PT-BR hand / draw hint from hole + board (never opponents). */
export function describeMyHand(hole: Card[] | null, community: Card[]): string | null {
  if (!hole || hole.length < 2) return null;

  const [a, b] = hole;
  const va = RANK_VALUE[a.rank];
  const vb = RANK_VALUE[b.rank];
  const suited = a.suit === b.suit;
  const paired = va === vb;

  if (community.length === 0) {
    if (paired) return `Par de ${pluralRank(va)}`;
    const hi = Math.max(va, vb);
    const lo = Math.min(va, vb);
    const hiR = hi === va ? a.rank : b.rank;
    const loR = lo === va ? a.rank : b.rank;
    if (suited && hi - lo <= 4) {
      return `${rankLabel(hiR)} e ${rankLabel(loR)} do mesmo naipe`;
    }
    if (suited) return `${rankLabel(hiR)}-${rankLabel(loR)} suited`;
    if (hi >= 12 && lo >= 10) return `${rankLabel(hiR)} e ${rankLabel(loR)} altos`;
    if (hi === 14) return `Ás e ${rankLabel(loR)}`;
    return `${rankLabel(hiR)} e ${rankLabel(loR)}`;
  }

  const made = bestHand(hole, community);
  const base = madeNamePt(made.name, made.score);

  // Draws (flop/turn only)
  if (community.length < 5) {
    const draws = detectDraws(hole, community);
    if (draws.length && made.score[0] < 4) {
      return `${base} · ${draws.join(" · ")}`;
    }
  }
  return base;
}

function madeNamePt(name: string, score: number[]): string {
  const map: Record<string, string> = {
    "Royal Flush": "Royal flush",
    "Straight Flush": "Straight flush",
    Quadra: "Quadra",
    "Full House": "Full house",
    Flush: "Flush",
    Straight: "Sequência",
    Trinca: "Trinca",
    "Dois Pares": "Dois pares",
    Par: score[1] ? `Par de ${pluralRank(score[1])}` : "Par",
    "Carta Alta": score[1] ? `Carta alta: ${RANK_PT[score[1]] ?? score[1]}` : "Carta alta",
  };
  return map[name] ?? name;
}

function detectDraws(hole: Card[], community: Card[]): string[] {
  const all = [...hole, ...community];
  const draws: string[] = [];

  const bySuit = new Map<string, number>();
  for (const c of all) bySuit.set(c.suit, (bySuit.get(c.suit) ?? 0) + 1);
  for (const [, n] of bySuit) {
    if (n === 4) {
      draws.push("draw de flush");
      break;
    }
  }

  const vals = [...new Set(all.map((c) => RANK_VALUE[c.rank]))].sort((a, b) => a - b);
  // Include wheel A as 1
  if (vals.includes(14)) vals.unshift(1);
  let oesd = false;
  let gutshot = false;
  for (let i = 0; i < vals.length; i++) {
    for (let j = i + 1; j < vals.length; j++) {
      const window = vals.slice(i, j + 1);
      const span = window[window.length - 1] - window[0];
      if (window.length === 4 && span === 3) oesd = true;
      if (window.length === 4 && span === 4) gutshot = true;
    }
  }
  if (oesd) draws.push("draw de sequência");
  else if (gutshot) draws.push("gutshot");

  return draws;
}
