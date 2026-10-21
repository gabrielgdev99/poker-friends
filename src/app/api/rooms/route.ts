import { NextResponse } from "next/server";
import { randomCode, randomId } from "@/lib/codes";
import { createRoom } from "@/lib/poker/engine";
import { toPublicRoom } from "@/lib/public-room";
import { roomExists, saveRoom, storeMode } from "@/lib/store";


export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    nickname?: string;
    playerId?: string;
  };
  const nickname = (body.nickname ?? "Anfitrião").slice(0, 16);
  const playerId = body.playerId || randomId();

  let code = randomCode();
  for (let i = 0; i < 8; i++) {
    if (!(await roomExists(code))) break;
    code = randomCode();
  }

  const room = createRoom(code, playerId, nickname);
  await saveRoom(room);

  return NextResponse.json({
    playerId,
    room: toPublicRoom(room, playerId),
    store: storeMode(),
  });
}

export async function GET() {
  return NextResponse.json({ store: storeMode(), ok: true });
}
