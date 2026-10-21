import { advanceBots } from "@/lib/poker/bots";
import { resetTurnClock } from "@/lib/poker/clock";
import { applyAction, startHand } from "@/lib/poker/engine";
import type { Room } from "@/lib/types";

export { DEFAULT_TURN_SECONDS, SHOWDOWN_MS, defaultTurnSeconds, resetTurnClock } from "@/lib/poker/clock";

/** Auto check if free, else fold. Returns true if acted. */
export function enforceTurnTimeout(room: Room): boolean {
  if (room.status !== "playing" || room.actingSeat === null) return false;
  if (!room.turnDeadline || Date.now() < room.turnDeadline) return false;
  const actor = room.players.find((p) => p.seat === room.actingSeat);
  if (!actor || actor.folded || actor.allIn) return false;
  const toCall = room.currentBet - actor.bet;
  try {
    if (toCall <= 0) applyAction(room, actor.id, "check");
    else applyAction(room, actor.id, "fold");
    return true;
  } catch {
    return false;
  }
}

export function maybeAutoStart(room: Room): boolean {
  if (room.status !== "showdown" || !room.autoStartNext) return false;
  if (!room.showdownUntil || Date.now() < room.showdownUntil) return false;
  try {
    startHand(room, room.hostId);
    return true;
  } catch {
    room.showdownUntil = null;
    return false;
  }
}

/** Timeout → bots → auto-start. Returns whether room mutated. */
export function tickRoom(room: Room): boolean {
  let changed = false;
  for (let i = 0; i < 8; i++) {
    const beforeStatus = room.status;
    const beforeSeat = room.actingSeat;
    const beforeUpdated = room.updatedAt;
    if (enforceTurnTimeout(room)) changed = true;
    if (advanceBots(room)) changed = true;
    if (
      room.updatedAt === beforeUpdated &&
      room.status === beforeStatus &&
      room.actingSeat === beforeSeat
    ) {
      break;
    }
  }
  if (maybeAutoStart(room)) {
    changed = true;
    advanceBots(room);
    resetTurnClock(room);
  }
  return changed;
}
