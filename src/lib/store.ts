import { Redis } from "@upstash/redis";
import type { Room } from "@/lib/types";

const PREFIX = "poker:room:";

type MemoryBag = Map<string, Room>;

function memory(): MemoryBag {
  const g = globalThis as unknown as { __pokerRooms?: MemoryBag };
  if (!g.__pokerRooms) g.__pokerRooms = new Map();
  return g.__pokerRooms;
}

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function storeMode(): "redis" | "memory" {
  return redis() ? "redis" : "memory";
}

export async function getRoom(code: string): Promise<Room | null> {
  const key = PREFIX + code.toUpperCase();
  const r = redis();
  if (r) {
    const data = await r.get<Room>(key);
    return data ?? null;
  }
  return memory().get(key) ?? null;
}

export async function saveRoom(room: Room): Promise<void> {
  room.updatedAt = Date.now();
  const key = PREFIX + room.code.toUpperCase();
  const r = redis();
  if (r) {
    // ponytail: 24h TTL; longer rooms can re-save on activity
    await r.set(key, room, { ex: 60 * 60 * 24 });
    return;
  }
  memory().set(key, room);
}

export async function roomExists(code: string): Promise<boolean> {
  return (await getRoom(code)) !== null;
}
