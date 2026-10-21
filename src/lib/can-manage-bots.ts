import { isAdminEmail } from "@/lib/admin";
import type { AuthUser } from "@/lib/require-user";
import type { Room } from "@/lib/types";

export function canManageBots(user: AuthUser, room: Room): boolean {
  return room.hostId === user.id || isAdminEmail(user.email);
}
