import { Redis } from "@upstash/redis";
import type { StatsQueue } from "@/lib/types";

const PREFIX = "poker:stat:";
const LB_CHIPS = "poker:lb:chips";
const LB_HANDS = "poker:lb:hands";
const LB_TABLES = "poker:lb:tables";

export type LeaderRow = {
  id: string;
  nickname: string;
  chipsWon: number;
  handsWon: number;
  tablesWon: number;
};

type MemoryStats = Map<string, LeaderRow>;

function memory(): MemoryStats {
  const g = globalThis as unknown as { __pokerStats?: MemoryStats };
  if (!g.__pokerStats) g.__pokerStats = new Map();
  return g.__pokerStats;
}

function redis(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim() ||
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim() ||
    "";
  if (!url || !token) return null;
  const g = globalThis as unknown as { __pokerRedisStats?: Redis };
  if (!g.__pokerRedisStats) {
    g.__pokerRedisStats = new Redis({ url, token });
  }
  return g.__pokerRedisStats;
}

async function bump(
  id: string,
  nickname: string,
  delta: { chips?: number; hands?: number; tables?: number },
): Promise<void> {
  const r = redis();
  if (r) {
    const key = PREFIX + id;
    const cur = (await r.hgetall<Record<string, string>>(key)) || {};
    const row: LeaderRow = {
      id,
      nickname: nickname || cur.nickname || "Jogador",
      chipsWon: Number(cur.chipsWon || 0) + (delta.chips || 0),
      handsWon: Number(cur.handsWon || 0) + (delta.hands || 0),
      tablesWon: Number(cur.tablesWon || 0) + (delta.tables || 0),
    };
    await r.hset(key, {
      nickname: row.nickname,
      chipsWon: String(row.chipsWon),
      handsWon: String(row.handsWon),
      tablesWon: String(row.tablesWon),
    });
    await r.zadd(LB_CHIPS, { score: row.chipsWon, member: id });
    await r.zadd(LB_HANDS, { score: row.handsWon, member: id });
    await r.zadd(LB_TABLES, { score: row.tablesWon, member: id });
    return;
  }
  const mem = memory();
  const prev = mem.get(id) || {
    id,
    nickname,
    chipsWon: 0,
    handsWon: 0,
    tablesWon: 0,
  };
  mem.set(id, {
    id,
    nickname: nickname || prev.nickname,
    chipsWon: prev.chipsWon + (delta.chips || 0),
    handsWon: prev.handsWon + (delta.hands || 0),
    tablesWon: prev.tablesWon + (delta.tables || 0),
  });
}

export async function flushStatsQueue(queue: StatsQueue | null | undefined): Promise<void> {
  if (!queue) return;
  for (const w of queue.handWins) {
    if (!w.id) continue;
    await bump(w.id, w.nickname, { chips: w.amount, hands: 1 });
  }
  if (queue.tableWin?.id) {
    await bump(queue.tableWin.id, queue.tableWin.nickname, { tables: 1 });
  }
}

async function topFromZ(key: string, n: number): Promise<LeaderRow[]> {
  const r = redis();
  if (!r) {
    const field =
      key === LB_CHIPS ? "chipsWon" : key === LB_HANDS ? "handsWon" : "tablesWon";
    return [...memory().values()]
      .sort((a, b) => b[field] - a[field])
      .slice(0, n);
  }
  const ids = (await r.zrange(key, 0, n - 1, { rev: true })) as string[];
  const rows: LeaderRow[] = [];
  for (const id of ids) {
    const cur = (await r.hgetall<Record<string, string>>(PREFIX + id)) || {};
    rows.push({
      id,
      nickname: cur.nickname || "Jogador",
      chipsWon: Number(cur.chipsWon || 0),
      handsWon: Number(cur.handsWon || 0),
      tablesWon: Number(cur.tablesWon || 0),
    });
  }
  return rows;
}

export async function getLeaderboards(limit = 20): Promise<{
  chipsWon: LeaderRow[];
  handsWon: LeaderRow[];
  tablesWon: LeaderRow[];
}> {
  const [chipsWon, handsWon, tablesWon] = await Promise.all([
    topFromZ(LB_CHIPS, limit),
    topFromZ(LB_HANDS, limit),
    topFromZ(LB_TABLES, limit),
  ]);
  return { chipsWon, handsWon, tablesWon };
}
