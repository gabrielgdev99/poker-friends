import { Redis } from "@upstash/redis";
import type { Room } from "@/lib/types";

const PREFIX = "poker:room:";
const INDEX = "poker:room-index";

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
  const code = room.code.toUpperCase();
  const key = PREFIX + code;
  const r = redis();
  if (r) {
    // ponytail: 24h TTL; longer rooms can re-save on activity
    await r.set(key, room, { ex: 60 * 60 * 24 });
    await r.sadd(INDEX, code);
    return;
  }
  memory().set(key, room);
}

export async function deleteRoom(code: string): Promise<boolean> {
  const upper = code.toUpperCase();
  const key = PREFIX + upper;
  const r = redis();
  if (r) {
    const n = await r.del(key);
    await r.srem(INDEX, upper);
    return n > 0;
  }
  return memory().delete(key);
}

export async function listRooms(): Promise<Room[]> {
  const r = redis();
  if (r) {
    const codes = (await r.smembers(INDEX)) as string[];
    if (!codes.length) return [];
    const rooms: Room[] = [];
    for (const code of codes) {
      const room = await getRoom(code);
      if (room) rooms.push(room);
      else await r.srem(INDEX, code.toUpperCase());
    }
    return rooms.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return [...memory().values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function roomExists(code: string): Promise<boolean> {
  return (await getRoom(code)) !== null;
}
