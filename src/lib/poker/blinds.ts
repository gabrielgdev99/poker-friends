import type { BlindSchedule, Room } from "@/lib/types";

export function defaultBlindSchedule(): BlindSchedule {
  return {
    enabled: false,
    mode: "hands",
    every: 4,
    multiplier: 2,
    level: 0,
    levelStartedAt: null,
    handsAtLevel: 0,
  };
}

export function nextBlinds(room: Room): { sb: number; bb: number } {
  const mult = room.blindSchedule?.multiplier || 2;
  const sb = Math.max(1, Math.floor(room.smallBlind * mult));
  return { sb, bb: Math.max(2, sb * 2) };
}

export function blindsProgressLabel(room: Room, now = Date.now()): string | null {
  const s = room.blindSchedule;
  if (!s?.enabled) return null;
  if (s.mode === "hands") {
    const left = Math.max(0, s.every - s.handsAtLevel);
    return left === 0 ? "sobe na próxima" : `em ${left} mão${left === 1 ? "" : "s"}`;
  }
  if (!s.levelStartedAt) return `a cada ${s.every} min`;
  const ms = s.every * 60 * 1000 - (now - s.levelStartedAt);
  if (ms <= 0) return "sobe já";
  const min = Math.ceil(ms / 60000);
  return `em ~${min} min`;
}

/** Bump blinds when schedule is due. Safe mid-hand (affects next posts). */
export function maybeBumpBlinds(room: Room, now = Date.now()): boolean {
  const s = room.blindSchedule;
  if (!s?.enabled) return false;

  let due = false;
  if (s.mode === "time") {
    if (!s.levelStartedAt) {
      s.levelStartedAt = now;
      return false;
    }
    due = now - s.levelStartedAt >= s.every * 60 * 1000;
  } else {
    due = s.handsAtLevel >= s.every;
  }
  if (!due) return false;

  const mult = s.multiplier >= 1.5 ? s.multiplier : 2;
  room.smallBlind = Math.max(1, Math.floor(room.smallBlind * mult));
  room.bigBlind = Math.max(room.smallBlind * 2, 2);
  s.level += 1;
  s.levelStartedAt = now;
  s.handsAtLevel = 0;
  room.minRaise = room.bigBlind;
  room.lastAction = `Blinds ↑ nível ${s.level}: ${room.smallBlind}/${room.bigBlind}`;
  room.updatedAt = now;
  return true;
}

/** Call at the start of each new hand (before posting blinds). */
export function onHandStarting(room: Room): void {
  const s = room.blindSchedule;
  if (!s?.enabled) return;
  if (s.mode === "hands" && room.handNumber > 0) {
    s.handsAtLevel += 1;
  }
  if (s.mode === "time" && !s.levelStartedAt) {
    s.levelStartedAt = Date.now();
  }
  maybeBumpBlinds(room);
}
