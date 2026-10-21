"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearGuestLocal,
  guestDepositLocal,
  guestWithdrawLocal,
  readGuestLocal,
  writeGuestLocal,
  type GuestLocal,
} from "@/lib/guest-local";
import { GUEST_STACK, GUEST_STARTING_BANK } from "@/lib/bank-constants";
import type { FeltAccent } from "@/lib/types";

type PlayerMode = "loading" | "none" | "google" | "guest";

type PlayerCtx = {
  mode: PlayerMode;
  id: string;
  name: string;
  isGuest: boolean;
  image: string | null;
  isAdmin: boolean;
  /** Google Redis bank or guest local bank. */
  bankBalance: number | null;
  canClaimDaily: boolean;
  buyIn: number;
  guest: GuestLocal | null;
  refreshBank: () => Promise<void>;
  claimDaily: () => Promise<string | null>;
  continueAsGuest: (nickname?: string) => Promise<void>;
  exitGuest: () => Promise<void>;
  /** Call after create/join as guest to debit local bank. */
  noteGuestBuyIn: () => void;
  /** Call after leave as guest to credit local bank. */
  noteGuestReturn: (chips: number) => void;
  updateGuestPrefs: (patch: Partial<GuestLocal>) => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [guest, setGuest] = useState<GuestLocal | null>(null);
  const [bankBalance, setBankBalance] = useState<number | null>(null);
  const [canClaimDaily, setCanClaim] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setGuest(readGuestLocal());
    setReady(true);
  }, []);

  const refreshBank = useCallback(async () => {
    if (session?.user) {
      const res = await fetch("/api/bank");
      if (!res.ok) return;
      const data = await res.json();
      setBankBalance(typeof data.balance === "number" ? data.balance : null);
      setCanClaim(!!data.canClaim);
      return;
    }
    const g = readGuestLocal();
    if (g) {
      setGuest(g);
      setBankBalance(g.bank);
      setCanClaim(false);
    } else {
      setBankBalance(null);
    }
  }, [session?.user]);

  useEffect(() => {
    if (status === "loading" || !ready) return;
    refreshBank();
  }, [status, ready, session?.user?.id, guest?.id, refreshBank]);

  const continueAsGuest = useCallback(async (nickname?: string) => {
    const existing = readGuestLocal();
    const res = await fetch("/api/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: nickname || existing?.nickname || "Convidado",
        guestId: existing?.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao criar convidado");
    const next: GuestLocal = {
      id: data.id,
      nickname: (nickname || existing?.nickname || data.nickname || "Convidado").slice(0, 16),
      emoji: existing?.emoji || "☕",
      chipColor: existing?.chipColor || "#f0b429",
      feltAccent: (existing?.feltAccent || "olive") as FeltAccent,
      bank: existing?.bank ?? GUEST_STARTING_BANK,
    };
    writeGuestLocal(next);
    setGuest(next);
    setBankBalance(next.bank);
  }, []);

  const exitGuest = useCallback(async () => {
    await fetch("/api/guest", { method: "DELETE" });
    clearGuestLocal();
    setGuest(null);
    setBankBalance(null);
  }, []);

  const claimDaily = useCallback(async () => {
    const res = await fetch("/api/bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error as string;
    setBankBalance(data.balance);
    setCanClaim(false);
    return null;
  }, []);

  const noteGuestBuyIn = useCallback(() => {
    const g = guestWithdrawLocal(GUEST_STACK);
    if (g) {
      setGuest(g);
      setBankBalance(g.bank);
    }
  }, []);

  const noteGuestReturn = useCallback((chips: number) => {
    const g = guestDepositLocal(chips);
    if (g) {
      setGuest(g);
      setBankBalance(g.bank);
    }
  }, []);

  const updateGuestPrefs = useCallback((patch: Partial<GuestLocal>) => {
    const cur = readGuestLocal();
    if (!cur) return;
    const next = { ...cur, ...patch };
    writeGuestLocal(next);
    setGuest(next);
  }, []);

  const value = useMemo<PlayerCtx>(() => {
    if (status === "loading" || !ready) {
      return {
        mode: "loading",
        id: "",
        name: "",
        isGuest: false,
        image: null,
        isAdmin: false,
        bankBalance: null,
        canClaimDaily: false,
        buyIn: 1000,
        guest: null,
        refreshBank,
        claimDaily,
        continueAsGuest,
        exitGuest,
        noteGuestBuyIn,
        noteGuestReturn,
        updateGuestPrefs,
      };
    }
    if (session?.user?.id) {
      return {
        mode: "google",
        id: session.user.id,
        name: session.user.name || "Jogador",
        isGuest: false,
        image: session.user.image ?? null,
        isAdmin: !!session.user.isAdmin,
        bankBalance,
        canClaimDaily,
        buyIn: 1000,
        guest: null,
        refreshBank,
        claimDaily,
        continueAsGuest,
        exitGuest,
        noteGuestBuyIn,
        noteGuestReturn,
        updateGuestPrefs,
      };
    }
    if (guest) {
      return {
        mode: "guest",
        id: guest.id,
        name: guest.nickname,
        isGuest: true,
        image: null,
        isAdmin: false,
        bankBalance: guest.bank,
        canClaimDaily: false,
        buyIn: GUEST_STACK,
        guest,
        refreshBank,
        claimDaily,
        continueAsGuest,
        exitGuest,
        noteGuestBuyIn,
        noteGuestReturn,
        updateGuestPrefs,
      };
    }
    return {
      mode: "none",
      id: "",
      name: "",
      isGuest: false,
      image: null,
      isAdmin: false,
      bankBalance: null,
      canClaimDaily: false,
      buyIn: 1000,
      guest: null,
      refreshBank,
      claimDaily,
      continueAsGuest,
      exitGuest,
      noteGuestBuyIn,
      noteGuestReturn,
      updateGuestPrefs,
    };
  }, [
    status,
    ready,
    session,
    guest,
    bankBalance,
    canClaimDaily,
    refreshBank,
    claimDaily,
    continueAsGuest,
    exitGuest,
    noteGuestBuyIn,
    noteGuestReturn,
    updateGuestPrefs,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer outside PlayerProvider");
  return ctx;
}
