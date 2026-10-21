import { Redis } from "@upstash/redis";
import { DAILY_CLAIM, STARTING_BANK } from "@/lib/bank-constants";

export { BUY_IN, DAILY_CLAIM, GUEST_STACK, STARTING_BANK } from "@/lib/bank-constants";

const PREFIX = "poker:bank:";

export type ChipBank = {
  balance: number;
  lastClaimAt: number | null;
};

function memory(): Map<string, ChipBank> {
  const g = globalThis as unknown as { __pokerBank?: Map<string, ChipBank> };
  if (!g.__pokerBank) g.__pokerBank = new Map();
  return g.__pokerBank;
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
  const g = globalThis as unknown as { __pokerRedisBank?: Redis };
  if (!g.__pokerRedisBank) {
    g.__pokerRedisBank = new Redis({ url, token });
  }
  return g.__pokerRedisBank;
}

function parseBank(raw: unknown): ChipBank | null {
  if (raw == null) return null;
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof data !== "object" || !data) return null;
  const o = data as Record<string, unknown>;
  return {
    balance: Math.max(0, Math.floor(Number(o.balance) || 0)),
    lastClaimAt: o.lastClaimAt == null ? null : Number(o.lastClaimAt) || null,
  };
}

async function write(userId: string, bank: ChipBank): Promise<void> {
  const r = redis();
  if (r) {
    await r.set(PREFIX + userId, JSON.stringify(bank), { ex: 60 * 60 * 24 * 180 });
    return;
  }
  memory().set(userId, bank);
}

export async function getBank(userId: string): Promise<ChipBank> {
  const r = redis();
  if (r) {
    const raw = await r.get(PREFIX + userId);
    const parsed = parseBank(raw);
    if (parsed) return parsed;
  } else {
    const mem = memory().get(userId);
    if (mem) return mem;
  }
  const fresh: ChipBank = { balance: STARTING_BANK, lastClaimAt: null };
  await write(userId, fresh);
  return fresh;
}

export async function ensureBank(userId: string): Promise<ChipBank> {
  return getBank(userId);
}

export async function withdraw(userId: string, amount: number): Promise<ChipBank> {
  const need = Math.floor(amount);
  if (need < 1) return getBank(userId);
  const bank = await getBank(userId);
  if (bank.balance < need) {
    throw new Error(
      `Banco insuficiente (${bank.balance}). Precisa de ${need}. Use a recarga diária ou joga com menos mesas.`,
    );
  }
  bank.balance -= need;
  await write(userId, bank);
  return bank;
}

export async function deposit(userId: string, amount: number): Promise<ChipBank> {
  const add = Math.max(0, Math.floor(amount));
  const bank = await getBank(userId);
  bank.balance += add;
  await write(userId, bank);
  return bank;
}

/** Once per UTC day — adds DAILY_CLAIM. */
export async function claimDaily(userId: string): Promise<{ bank: ChipBank; claimed: boolean; nextInMs: number }> {
  const bank = await getBank(userId);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (bank.lastClaimAt && now - bank.lastClaimAt < day) {
    return {
      bank,
      claimed: false,
      nextInMs: day - (now - bank.lastClaimAt),
    };
  }
  bank.balance += DAILY_CLAIM;
  bank.lastClaimAt = now;
  await write(userId, bank);
  return { bank, claimed: true, nextInMs: day };
}

export function canClaimDaily(bank: ChipBank, now = Date.now()): boolean {
  if (!bank.lastClaimAt) return true;
  return now - bank.lastClaimAt >= 24 * 60 * 60 * 1000;
}
