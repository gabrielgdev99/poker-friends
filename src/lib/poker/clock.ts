import { defaultBlindSchedule } from "@/lib/poker/blinds";
import type { Room } from "@/lib/types";

export const DEFAULT_TURN_SECONDS = 18;
export const SHOWDOWN_MS = 4500;

export function defaultTurnSeconds(): number {
  const n = Number(process.env.TURN_SECONDS);
  if (Number.isFinite(n) && n >= 8 && n <= 60) return Math.floor(n);
  return DEFAULT_TURN_SECONDS;
}

/** Random bot “thinking” pause in ms (1–3s). */
export function botThinkMs(): number {
  return 1000 + Math.floor(Math.random() * 2000);
}

export function resetTurnClock(room: Room): void {
  if (room.status !== "playing" || room.actingSeat === null) {
    room.turnDeadline = null;
    return;
  }
  const actor = room.players.find((p) => p.seat === room.actingSeat);
  if (actor?.isBot) {
    // Short think window; timeout still auto check/fold if something stalls
    room.turnDeadline = Date.now() + botThinkMs();
    return;
  }
  const secs = room.turnSeconds || defaultTurnSeconds();
  room.turnDeadline = Date.now() + secs * 1000;
}

/** Fill fields missing from older Redis rooms. */
export function normalizeRoom(room: Room): Room {
  if (!Array.isArray(room.players)) room.players = [];
  if (!Array.isArray(room.chat)) room.chat = [];
  if (room.turnSeconds == null) room.turnSeconds = defaultTurnSeconds();
  if (room.turnDeadline === undefined) room.turnDeadline = null;
  if (room.autoStartNext == null) room.autoStartNext = true;
  if (room.showdownUntil === undefined) room.showdownUntil = null;
  if (room.sbSeat === undefined) room.sbSeat = null;
  if (room.bbSeat === undefined) room.bbSeat = null;
  if (room.lastSeatAction === undefined) room.lastSeatAction = null;
  if (!room.blindSchedule) room.blindSchedule = defaultBlindSchedule();
  if (room.tableEnded == null) room.tableEnded = false;
  if (room.championId === undefined) room.championId = null;
  if (room.statsQueue === undefined) room.statsQueue = null;
  room.code = String(room.code ?? "").toUpperCase();
  for (const p of room.players) {
    if (p.isBot == null) p.isBot = false;
    if (p.busted == null) p.busted = false;
    if (p.botDifficulty === undefined) {
      p.botDifficulty = p.isBot ? "medium" : null;
    }
    if (!p.emoji) p.emoji = p.isBot ? "🤖" : "🙏";
    if (!p.chipColor) p.chipColor = "#f0b429";
  }
  return room;
}
