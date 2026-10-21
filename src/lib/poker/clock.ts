import type { Room } from "@/lib/types";

export const DEFAULT_TURN_SECONDS = 18;
export const SHOWDOWN_MS = 4500;

export function defaultTurnSeconds(): number {
  const n = Number(process.env.TURN_SECONDS);
  if (Number.isFinite(n) && n >= 8 && n <= 60) return Math.floor(n);
  return DEFAULT_TURN_SECONDS;
}

export function resetTurnClock(room: Room): void {
  if (room.status !== "playing" || room.actingSeat === null) {
    room.turnDeadline = null;
    return;
  }
  const actor = room.players.find((p) => p.seat === room.actingSeat);
  const secs = actor?.isBot ? 1 : room.turnSeconds || defaultTurnSeconds();
  room.turnDeadline = Date.now() + secs * 1000;
}

/** Fill fields missing from older Redis rooms. */
export function normalizeRoom(room: Room): Room {
  if (room.turnSeconds == null) room.turnSeconds = defaultTurnSeconds();
  if (room.turnDeadline === undefined) room.turnDeadline = null;
  if (room.autoStartNext == null) room.autoStartNext = true;
  if (room.showdownUntil === undefined) room.showdownUntil = null;
  if (room.sbSeat === undefined) room.sbSeat = null;
  if (room.bbSeat === undefined) room.bbSeat = null;
  if (room.lastSeatAction === undefined) room.lastSeatAction = null;
  for (const p of room.players) {
    if (p.isBot == null) p.isBot = false;
  }
  return room;
}
