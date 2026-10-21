import { RANK_VALUE } from "@/lib/poker/cards";
import { resetTurnClock } from "@/lib/poker/clock";
import { BUY_IN } from "@/lib/bank-constants";
import { applyAction, roomMaxSeats } from "@/lib/poker/engine";
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

type DiffTune = {
  /** Extra willingness to open/bet when free. */
  aggression: number;
  /** Fold more often with weak hands facing a bet. */
  foldWeak: number;
  /** Raise more often with strong hands. */
  raiseStrong: number;
  /** Min strength to call a big bet. */
  callFloor: number;
  /** Prefer pot-aware raise sizing. */
  smartSize: boolean;
};

function tune(d: BotDifficulty | null | undefined): DiffTune {
  switch (d) {
    case "easy":
      return {
        aggression: 0.08,
        foldWeak: 0.35,
        raiseStrong: 0.18,
        callFloor: 0.12,
        smartSize: false,
      };
    case "hard":
      return {
        aggression: 0.28,
        foldWeak: 0.78,
        raiseStrong: 0.55,
        callFloor: 0.38,
        smartSize: true,
      };
    default:
      return {
        aggression: 0.18,
        foldWeak: 0.58,
        raiseStrong: 0.38,
        callFloor: 0.22,
        smartSize: true,
      };
  }
}

function holeStrength(hole: Card[] | null): number {
  if (!hole || hole.length < 2) return 0.2;
  const [a, b] = hole;
  const va = RANK_VALUE[a.rank];
  const vb = RANK_VALUE[b.rank];
  const high = Math.max(va, vb);
  const low = Math.min(va, vb);
  const suited = a.suit === b.suit;
  const paired = va === vb;
  if (paired) return 0.55 + high / 40;
  let s = high / 20 + low / 40;
  if (suited) s += 0.08;
  if (high - low <= 2) s += 0.06;
  if (high >= 12) s += 0.1;
  return Math.min(0.95, Math.max(0.1, s));
}

function raiseSize(room: Room, player: Player, strength: number, smart: boolean): number {
  const minTo = room.currentBet === 0 ? room.bigBlind : room.currentBet + room.minRaise;
  const stackTo = player.bet + player.chips;
  if (!smart) {
    const wild = room.bigBlind * (1 + Math.floor(Math.random() * 5));
    return Math.min(stackTo, Math.max(minTo, player.bet + wild));
  }
  const pot = Math.max(room.pot, room.bigBlind * 2);
  const want =
    strength > 0.8
      ? Math.max(minTo, Math.floor(pot * 0.9))
      : strength > 0.55
        ? Math.max(minTo, Math.floor(pot * 0.55))
        : minTo;
  return Math.min(stackTo, want);
}

export function decideBotAction(
  room: Room,
  player: Player,
): { action: PlayerAction; amount?: number } {
  const toCall = Math.max(0, room.currentBet - player.bet);
  const strength = holeStrength(player.hole);
  const t = tune(player.botDifficulty);
  const roll = Math.random();

  if (toCall <= 0) {
    if (roll < t.aggression + strength * 0.35 && player.chips > room.bigBlind) {
      const raiseTo = raiseSize(room, player, strength, t.smartSize);
      return { action: "bet", amount: raiseTo };
    }
    return { action: "check" };
  }

  const potOddsPressure = toCall / Math.max(1, room.pot + toCall);
  const expensive = toCall > room.bigBlind * 2 || potOddsPressure > 0.35;

  if (expensive && strength < t.callFloor + 0.15 && roll < t.foldWeak) {
    return { action: "fold" };
  }
  if (strength < t.callFloor && expensive) {
    return { action: "fold" };
  }
  // Easy bots sometimes call trash
  if (player.botDifficulty === "easy" && strength < 0.25 && roll < 0.45 && !expensive) {
    return { action: "call" };
  }

  if (
    strength > 0.55 &&
    roll < t.raiseStrong + strength * 0.15 &&
    player.chips > toCall + room.minRaise
  ) {
    const raiseTo = raiseSize(room, player, strength, t.smartSize);
    if (raiseTo > room.currentBet) {
      return { action: "raise", amount: raiseTo };
    }
  }

  return { action: "call" };
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
