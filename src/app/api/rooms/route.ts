import { NextResponse } from "next/server";
import { BUY_IN, GUEST_STACK, withdraw } from "@/lib/bank";
import { randomCode } from "@/lib/codes";
import { createRoom } from "@/lib/poker/engine";
import { getProfile } from "@/lib/profile";
import { toPublicRoom } from "@/lib/public-room";
import { displayNickname, requireUser } from "@/lib/require-user";
import {
  redisConfigured,
  requirePersistentStore,
  roomExists,
  saveRoomVerified,
  storeMode,
} from "@/lib/store";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: "Faça login com Google ou continue como convidado" },
      { status: 401 },
    );
  }

  try {
    requirePersistentStore();
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Store indisponível",
        store: storeMode(),
        redisConfigured: redisConfigured(),
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { nickname?: string };
  const profile = await getProfile(user.id, user.name);
  const nickname = displayNickname(
    body.nickname || profile.nickname,
    user,
    user.isGuest ? "Convidado" : "Anfitrião",
  );
  const playerId = user.id;
  const stack = user.isGuest ? GUEST_STACK : BUY_IN;

  let bankBalance: number | null = null;
  if (!user.isGuest) {
    try {
      const bank = await withdraw(user.id, stack);
      bankBalance = bank.balance;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Banco insuficiente" },
        { status: 400 },
      );
    }
  }

  let code = randomCode();
  for (let i = 0; i < 8; i++) {
    if (!(await roomExists(code))) break;
    code = randomCode();
  }

  const room = createRoom(code, playerId, nickname);
  const host = room.players[0];
  if (host) {
    host.emoji = profile.emoji;
    host.chipColor = profile.chipColor;
    host.chips = stack;
  }
  try {
    await saveRoomVerified(room);
  } catch (e) {
    // refund Google buy-in if room failed to persist
    if (!user.isGuest) {
      try {
        const { deposit } = await import("@/lib/bank");
        await deposit(user.id, stack);
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Falha ao criar sala",
        store: storeMode(),
        redisConfigured: redisConfigured(),
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    playerId,
    room: toPublicRoom(room, playerId),
    store: storeMode(),
    buyIn: stack,
    bankBalance,
    isGuest: user.isGuest,
  });
}

export async function GET() {
  const mode = storeMode();
  return NextResponse.json({
    ok: true,
    store: mode,
    redisConfigured: redisConfigured(),
    vercel: process.env.VERCEL === "1",
    hint:
      mode === "memory"
        ? "Store em memória: salas somem entre requests na Vercel. Configure Upstash Redis."
        : undefined,
  });
}
