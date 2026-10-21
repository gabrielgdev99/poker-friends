/** Client-only guest prefs + local chip bank (localStorage). */

import { GUEST_STARTING_BANK } from "@/lib/bank-constants";
import type { FeltAccent } from "@/lib/types";

export const GUEST_STORAGE_KEY = "poker-friends-guest-v1";

export type GuestLocal = {
  id: string;
  nickname: string;
  emoji: string;
  chipColor: string;
  feltAccent: FeltAccent;
  /** Local chip bank — not Redis. */
  bank: number;
};

export function readGuestLocal(): GuestLocal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GuestLocal;
    if (!g?.id?.startsWith("guest_")) return null;
    return {
      id: g.id,
      nickname: (g.nickname || "Convidado").slice(0, 16),
      emoji: g.emoji || "☕",
      chipColor: g.chipColor || "#f0b429",
      feltAccent: g.feltAccent || "olive",
      bank: Math.max(0, Math.floor(Number(g.bank) || GUEST_STARTING_BANK)),
    };
  } catch {
    return null;
  }
}

export function writeGuestLocal(g: GuestLocal): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(g));
}

export function clearGuestLocal(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_STORAGE_KEY);
}

export function guestWithdrawLocal(amount: number): GuestLocal | null {
  const g = readGuestLocal();
  if (!g) return null;
  // Friends mode: never block the table — floor at 0
  g.bank = Math.max(0, g.bank - Math.max(0, Math.floor(amount)));
  writeGuestLocal(g);
  return g;
}

export function guestDepositLocal(amount: number): GuestLocal | null {
  const g = readGuestLocal();
  if (!g) return null;
  g.bank += Math.max(0, Math.floor(amount));
  writeGuestLocal(g);
  return g;
}
