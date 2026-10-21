import { RANK_VALUE } from "@/lib/poker/cards";
import { resetTurnClock } from "@/lib/poker/clock";
import { applyAction } from "@/lib/poker/engine";
import type { Card, Player, PlayerAction, Room } from "@/lib/types";

const MAX_SEATS = 10;

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

export function decideBotAction(
  room: Room,
  player: Player,
): { action: PlayerAction; amount?: number } {
  const toCall = Math.max(0, room.currentBet - player.bet);
  const strength = holeStrength(player.hole);
  const roll = Math.random();

  if (toCall <= 0) {
    if (roll < 0.12 + strength * 0.25 && player.chips > room.bigBlind) {
      const size = room.bigBlind * (2 + Math.floor(Math.random() * 3));
      const raiseTo = Math.min(player.bet + player.chips, Math.max(room.bigBlind, size));
      return { action: "bet", amount: raiseTo };
    }
    return { action: "check" };
  }

  const cheap = toCall <= room.bigBlind * 2;
  if (!cheap && strength < 0.35 && roll < 0.65) {
    return { action: "fold" };
  }
  if (strength < 0.2 && !cheap) {
    return { action: "fold" };
  }

  if (
    strength > 0.65 &&
    roll < 0.4 &&
    player.chips > toCall + room.minRaise
  ) {
    const raiseTo = Math.min(
      player.bet + player.chips,
      room.currentBet + room.minRaise,
    );
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
  // applyAction already resetTurnClock for the next actor
  if (room.status === "playing" && room.actingSeat !== null) {
    const next = room.players.find((p) => p.seat === room.actingSeat);
    if (next?.isBot && !room.turnDeadline) resetTurnClock(room);
  }
  return true;
}

export function addBot(room: Room): Player {
  if (room.status === "playing") throw new Error("Espere o fim da mão");
  const taken = new Set(
    room.players.filter((p) => p.seat !== null).map((p) => p.seat as number),
  );
  let seat: number | null = null;
  for (let s = 0; s < MAX_SEATS; s++) {
    if (!taken.has(s)) {
      seat = s;
      break;
    }
  }
  if (seat === null) throw new Error("Mesa cheia (10 assentos)");

  const used = new Set(room.players.map((p) => p.nickname));
  const nickname =
    BOT_NAMES.find((n) => !used.has(n)) ??
    `Irmão Bot ${room.players.filter((p) => p.isBot).length + 1}`;

  const bot: Player = {
    id: `bot-${Date.now()}-${seat}`,
    nickname,
    seat,
    chips: 1000,
    hole: null,
    bet: 0,
    folded: false,
    allIn: false,
    actedThisRound: false,
    isBot: true,
  };
  room.players.push(bot);
  room.lastAction = `${bot.nickname} sentou — “a paz do Senhor e… all-in?”`;
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
