import type { Room } from "@/lib/types";

/** Lobby, showdown, or a finished table with no hand for this long is removed. */
export const QUIET_MS = 24 * 60 * 60 * 1000;

export function isQuietExpired(
  room: Pick<Room, "status" | "quietSince" | "updatedAt">,
  now = Date.now(),
): boolean {
  if (room.status === "playing") return false;
  const since = room.quietSince ?? room.updatedAt;
  return now - since >= QUIET_MS;
}
