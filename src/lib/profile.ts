import { Redis } from "@upstash/redis";
import type { FeltAccent, UserProfile } from "@/lib/types";

const PREFIX = "poker:profile:";

const EMOJIS = ["🙏", "☕", "🃏", "✝️", "🐟", "🔥", "😎", "🙌", "🍞", "✨"];
const CHIP_COLORS = ["#f0b429", "#e8e0d0", "#7dd3fc", "#f9a8d4", "#86efac", "#fdba74"];
const FELTS: FeltAccent[] = ["olive", "wine", "navy", "amber"];

export const PROFILE_OPTIONS = {
  emojis: EMOJIS,
  chipColors: CHIP_COLORS,
  felts: FELTS,
  feltLabels: {
    olive: "Verde igreja",
    wine: "Vinho da ceia",
    navy: "Azul noite",
    amber: "Âmbar velas",
  } as Record<FeltAccent, string>,
};

export function defaultProfile(name?: string | null): UserProfile {
  return {
    nickname: (name || "Jogador").slice(0, 16),
    emoji: "🙏",
    chipColor: CHIP_COLORS[0],
    feltAccent: "olive",
  };
}

function memory(): Map<string, UserProfile> {
  const g = globalThis as unknown as { __pokerProfiles?: Map<string, UserProfile> };
  if (!g.__pokerProfiles) g.__pokerProfiles = new Map();
  return g.__pokerProfiles;
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
  const g = globalThis as unknown as { __pokerRedisProfile?: Redis };
  if (!g.__pokerRedisProfile) {
    g.__pokerRedisProfile = new Redis({ url, token });
  }
  return g.__pokerRedisProfile;
}

function sanitize(raw: Partial<UserProfile>, fallbackName?: string | null): UserProfile {
  const base = defaultProfile(fallbackName);
  const emoji = typeof raw.emoji === "string" && EMOJIS.includes(raw.emoji) ? raw.emoji : base.emoji;
  const chipColor =
    typeof raw.chipColor === "string" && CHIP_COLORS.includes(raw.chipColor)
      ? raw.chipColor
      : base.chipColor;
  const feltAccent =
    typeof raw.feltAccent === "string" && FELTS.includes(raw.feltAccent as FeltAccent)
      ? (raw.feltAccent as FeltAccent)
      : base.feltAccent;
  const nickname = (raw.nickname?.trim() || base.nickname).slice(0, 16);
  return { nickname, emoji, chipColor, feltAccent };
}

export async function getProfile(
  userId: string,
  fallbackName?: string | null,
): Promise<UserProfile> {
  const r = redis();
  if (r) {
    try {
      const data = await r.get<UserProfile | string>(PREFIX + userId);
      if (!data) return defaultProfile(fallbackName);
      const parsed = typeof data === "string" ? (JSON.parse(data) as UserProfile) : data;
      return sanitize(parsed, fallbackName);
    } catch {
      return defaultProfile(fallbackName);
    }
  }
  return memory().get(userId) ?? defaultProfile(fallbackName);
}

export async function saveProfile(
  userId: string,
  patch: Partial<UserProfile>,
  fallbackName?: string | null,
): Promise<UserProfile> {
  const cur = await getProfile(userId, fallbackName);
  // Merge only keys that are actually set (ignore undefined)
  const merged: Partial<UserProfile> = { ...cur };
  if (typeof patch.nickname === "string") merged.nickname = patch.nickname;
  if (typeof patch.emoji === "string") merged.emoji = patch.emoji;
  if (typeof patch.chipColor === "string") merged.chipColor = patch.chipColor;
  if (typeof patch.feltAccent === "string") merged.feltAccent = patch.feltAccent;
  const next = sanitize(merged, fallbackName);
  const r = redis();
  if (r) {
    await r.set(PREFIX + userId, JSON.stringify(next), { ex: 60 * 60 * 24 * 90 });
  } else {
    memory().set(userId, next);
  }
  return next;
}

