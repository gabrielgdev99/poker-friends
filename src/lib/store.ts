import { Redis } from "@upstash/redis";
import { deposit } from "@/lib/bank";
import { normalizeRoom } from "@/lib/poker/clock";
import { isQuietExpired } from "@/lib/quiet";
import { flushStatsQueue } from "@/lib/stats";
import type { Room } from "@/lib/types";

const PREFIX = "poker:room:";
const INDEX = "poker:room-index";

type MemoryBag = Map<string, Room>;

function memory(): MemoryBag {
  const g = globalThis as unknown as { __pokerRooms?: MemoryBag };
  if (!g.__pokerRooms) g.__pokerRooms = new Map();
  return g.__pokerRooms;
}

function redisCreds(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim() ||
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim() ||
    "";
  if (!url || !token) return null;
  return { url, token };
}

/** Singleton — avoid new client per request. */
function redis(): Redis | null {
  const creds = redisCreds();
  if (!creds) return null;
  const g = globalThis as unknown as { __pokerRedis?: Redis };
  if (!g.__pokerRedis) {
    g.__pokerRedis = new Redis({ url: creds.url, token: creds.token });
  }
  return g.__pokerRedis;
}

export function storeMode(): "redis" | "memory" {
  return redis() ? "redis" : "memory";
}

export function redisConfigured(): boolean {
  return redisCreds() !== null;
}

/** On Vercel, memory store cannot share rooms across instances. */
export function requirePersistentStore(): void {
  if (storeMode() === "redis") return;
  const onVercel = process.env.VERCEL === "1";
  const force = process.env.REQUIRE_REDIS === "1";
  if (onVercel || force) {
    throw new Error(
      "Redis não configurado. Na Vercel, defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN (ou KV_REST_API_URL / KV_REST_API_TOKEN) e faça redeploy.",
    );
  }
}

function parseRoom(data: unknown): Room | null {
  if (data == null) return null;
  let raw: unknown = data;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const room = raw as Room;
  if (!room.code || !Array.isArray(room.players)) return null;
  return normalizeRoom(room);
}

async function readRoom(code: string): Promise<Room | null> {
  const key = PREFIX + code.toUpperCase().trim();
  const r = redis();
  if (r) {
    try {
      const data = await r.get(key);
      return parseRoom(data);
    } catch (e) {
      console.error("[store] getRoom redis error", key, e);
      throw new Error(
        "Falha ao ler a sala no Redis. Verifique as credenciais Upstash na Vercel.",
      );
    }
  }
  const mem = memory().get(key);
  return mem ? normalizeRoom(mem) : null;
}

export async function getRoom(code: string): Promise<Room | null> {
  const room = await readRoom(code);
  if (!room) return null;
  // ponytail: sweep on read, not a cron. A hand in progress is kept.
  // Redis still drops untouched keys after 24h via the existing EX.
  if (!isQuietExpired(room)) return room;
  await retireRoom(room);
  return null;
}

export async function saveRoom(room: Room): Promise<void> {
  room.updatedAt = Date.now();
  room.code = room.code.toUpperCase().trim();
  if (room.statsQueue) {
    try {
      await flushStatsQueue(room.statsQueue);
    } catch (e) {
      console.error("[store] flushStatsQueue", e);
    }
    room.statsQueue = null;
  }
  const key = PREFIX + room.code;
  const r = redis();
  if (r) {
    try {
      // Explicit JSON — avoids rare double-encode / type quirks across SDK versions
      await r.set(key, JSON.stringify(room), { ex: 60 * 60 * 24 });
      await r.sadd(INDEX, room.code);
    } catch (e) {
      console.error("[store] saveRoom redis error", key, e);
      throw new Error(
        "Falha ao salvar a sala no Redis. Verifique UPSTASH_REDIS_REST_URL / TOKEN na Vercel.",
      );
    }
    return;
  }
  memory().set(key, room);
}

/** Create path: persist + read-back so we never redirect to a missing room. */
export async function saveRoomVerified(room: Room): Promise<void> {
  requirePersistentStore();
  await saveRoom(room);
  const again = await getRoom(room.code);
  if (!again) {
    throw new Error(
      "Sala não persistiu após salvar. Confira o Redis (Upstash) e tente de novo.",
    );
  }
}

export async function deleteRoom(code: string): Promise<boolean> {
  const upper = code.toUpperCase().trim();
  const key = PREFIX + upper;
  const r = redis();
  if (r) {
    const n = await r.del(key);
    await r.srem(INDEX, upper);
    return n > 0;
  }
  return memory().delete(key);
}

/** Delete the room, then return Google table chips. One winner if two reads race. */
export async function retireRoom(room: Room): Promise<boolean> {
  const removed = await deleteRoom(room.code);
  if (!removed) return false;
  for (const p of room.players) {
    if (p.isBot || p.id.startsWith("guest_")) continue;
    if (p.chips <= 0) continue;
    try {
      await deposit(p.id, p.chips);
    } catch {
      /* best effort */
    }
  }
  return true;
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
      else await r.srem(INDEX, String(code).toUpperCase());
    }
    return rooms.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return [...memory().values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function roomExists(code: string): Promise<boolean> {
  return (await getRoom(code)) !== null;
}
