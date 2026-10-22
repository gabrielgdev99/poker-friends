import { RANK_VALUE } from "@/lib/poker/cards";
import { resetTurnClock } from "@/lib/poker/clock";
import { BUY_IN } from "@/lib/bank-constants";
import { applyAction, roomMaxSeats } from "@/lib/poker/engine";
import { bestHand } from "@/lib/poker/hand-eval";
import type { BotDifficulty, Card, Player, PlayerAction, Room } from "@/lib/types";

const BOT_NAMES = [
  "Irmão Bot",
  "Diácono Bluff",
  "Tia Coral",
  "Obreiro All-in",
  "Pastor Check",
  "Irmã Sequência",
  "Zelador Fold",
  "Louvor Raise",
  "Café da Paz",
  "Amém Call",
];

export const BOT_DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: "Iniciante",
  medium: "Médio",
  hard: "Difícil",
};

export function parseBotDifficulty(raw: unknown): BotDifficulty {
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  if (raw === "iniciante") return "easy";
  if (raw === "medio" || raw === "médio") return "medium";
  if (raw === "dificil" || raw === "difícil") return "hard";
  return "medium";
}

/** Chen score. 72o is about 0, AA is 20. Used so bots fold junk instead of seeing every flop. */
export function chenScore(hole: Card[] | null): number {
  if (!hole || hole.length < 2) return 0;
  const [a, b] = hole;
  const high = Math.max(RANK_VALUE[a.rank], RANK_VALUE[b.rank]);
  const low = Math.min(RANK_VALUE[a.rank], RANK_VALUE[b.rank]);
  let score =
    high >= 14 ? 10 : high === 13 ? 8 : high === 12 ? 7 : high === 11 ? 6 : high / 2;
  if (high === low) score = Math.max(score * 2, 5);
  if (a.suit === b.suit) score += 2;
  const gap = high - low - 1;
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;
  if (gap <= 1 && high < 12 && a.suit === b.suit) score += 1;
  return score;
}

function lines(d: BotDifficulty | null | undefined): { open: number; threeBet: number } {
  if (d === "easy") return { open: 6, threeBet: 12 };
  if (d === "hard") return { open: 10, threeBet: 14 };
  return { open: 8, threeBet: 13 };
}

/** Legal "raise to" in big-blind steps. Never a random pile of chips. */
function sizedTo(room: Room, player: Player, wantTo: number): number {
  const bb = Math.max(1, room.bigBlind);
  const minTo = room.currentBet === 0 ? bb : room.currentBet + room.minRaise;
  const snapped = Math.round(wantTo / bb) * bb;
  const cap = player.bet + player.chips;
  return Math.min(cap, Math.max(minTo, snapped));
}

function potBetTo(room: Room, player: Player, frac: number): number {
  const pot = room.pot + Math.max(0, room.currentBet - player.bet);
  const add = Math.max(room.bigBlind, pot * frac);
  if (room.currentBet === 0) return sizedTo(room, player, add);
  return sizedTo(room, player, room.currentBet + add);
}

export function decideBotAction(
  room: Room,
  player: Player,
): { action: PlayerAction; amount?: number } {
  const toCall = Math.max(0, room.currentBet - player.bet);
  const bb = Math.max(1, room.bigBlind);
  const preflop = !room.community.length;
  const chen = chenScore(player.hole);
  const line = lines(player.botDifficulty);
  const made = !preflop && player.hole ? bestHand(player.hole, room.community) : null;
  const category = made?.score[0] ?? 0;

  const bet = (to: number): { action: PlayerAction; amount: number } => {
    const amount = to;
    if (amount <= room.currentBet) return { action: toCall > 0 ? "call" : "check", amount };
    return { action: room.currentBet === 0 ? "bet" : "raise", amount };
  };

  if (toCall <= 0) {
    if (preflop) {
      if (chen >= line.open && player.chips > bb) return bet(sizedTo(room, player, bb * 3));
      return { action: "check" };
    }
    if (category >= 2) return bet(potBetTo(room, player, 2 / 3));
    if (category === 1 && Math.random() < 0.6) return bet(potBetTo(room, player, 1 / 2));
    if (player.botDifficulty === "hard" && room.street === "flop" && Math.random() < 0.2) {
      return bet(potBetTo(room, player, 1 / 3));
    }
    return { action: "check" };
  }

  if (preflop) {
    const facingOpen = toCall <= bb * 4;
    if (chen >= line.threeBet && toCall <= bb * 8 && player.chips > toCall + bb) {
      return bet(sizedTo(room, player, room.currentBet * 3));
    }
    if (chen >= line.open && facingOpen) return { action: "call" };
    return { action: "fold" };
  }

  const cheap = toCall <= Math.max(bb * 2, room.pot * 0.45);
  if (category >= 2) {
    if (player.chips > toCall + room.minRaise && Math.random() < 0.45) {
      return bet(potBetTo(room, player, 2 / 3));
    }
    return { action: "call" };
  }
  if (category === 1 && cheap) return { action: "call" };
  if (player.botDifficulty === "easy" && cheap && Math.random() < 0.15) return { action: "call" };
  return { action: "fold" };
}

/**
 * Act for the current bot only after its think deadline.
 * One bot action per tick so polling shows the pause.
 */
export function advanceBots(room: Room): boolean {
  if (room.status !== "playing" || room.actingSeat === null) return false;
  const actor = room.players.find((p) => p.seat === room.actingSeat);
  if (!actor?.isBot) return false;

  // Still “thinking”
  if (room.turnDeadline && Date.now() < room.turnDeadline) {
    return false;
  }

  const decision = decideBotAction(room, actor);
  try {
    applyAction(room, actor.id, decision.action, decision.amount);
  } catch {
    try {
      const toCall = room.currentBet - actor.bet;
      if (toCall <= 0) applyAction(room, actor.id, "check");
      else applyAction(room, actor.id, "fold");
    } catch {
      return false;
    }
  }
  if (room.status === "playing" && room.actingSeat !== null) {
    const next = room.players.find((p) => p.seat === room.actingSeat);
    if (next?.isBot && !room.turnDeadline) resetTurnClock(room);
  }
  return true;
}

export function addBot(room: Room, difficulty: BotDifficulty = "medium"): Player {
  if (room.status === "playing") throw new Error("Espere o fim da mão");
  const taken = new Set(
    room.players.filter((p) => p.seat !== null).map((p) => p.seat as number),
  );
  const max = roomMaxSeats(room);
  let seat: number | null = null;
  for (let s = 0; s < max; s++) {
    if (!taken.has(s)) {
      seat = s;
      break;
    }
  }
  if (seat === null) throw new Error(`Mesa cheia (${max} assentos)`);

  const used = new Set(room.players.map((p) => p.nickname));
  const nickname =
    BOT_NAMES.find((n) => !used.has(n)) ??
    `Irmão Bot ${room.players.filter((p) => p.isBot).length + 1}`;

  const bot: Player = {
    id: `bot-${Date.now()}-${seat}`,
    nickname,
    seat,
    chips: BUY_IN,
    busted: false,
    hole: null,
    bet: 0,
    contributed: 0,
    folded: false,
    allIn: false,
    actedThisRound: false,
    isBot: true,
    botDifficulty: difficulty,
    emoji: difficulty === "hard" ? "🔥" : difficulty === "easy" ? "🍞" : "🤖",
    chipColor: difficulty === "hard" ? "#fdba74" : difficulty === "easy" ? "#86efac" : "#7dd3fc",
    avatarUrl: null,
  };
  room.players.push(bot);
  const label = BOT_DIFFICULTY_LABEL[difficulty];
  room.lastAction = `${bot.nickname} (${label}) sentou — “a paz do Senhor e… all-in?”`;
  room.updatedAt = Date.now();
  return bot;
}

export function removeBot(room: Room, botId: string): void {
  if (room.status === "playing") throw new Error("Espere o fim da mão");
  const bot = room.players.find((p) => p.id === botId);
  if (!bot?.isBot) throw new Error("Bot não encontrado");
  room.players = room.players.filter((p) => p.id !== botId);
  room.lastAction = `${bot.nickname} foi pra casa (com bênção)`;
  room.updatedAt = Date.now();
}
