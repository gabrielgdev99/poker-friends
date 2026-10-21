import { NextResponse } from "next/server";
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
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
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
    "Anfitrião",
  );
  const playerId = user.id;

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
  }
  try {
    await saveRoomVerified(room);
  } catch (e) {
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
