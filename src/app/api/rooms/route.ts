import { NextResponse } from "next/server";
import { randomCode } from "@/lib/codes";
import { createRoom } from "@/lib/poker/engine";
import { toPublicRoom } from "@/lib/public-room";
import { displayNickname, requireUser } from "@/lib/require-user";
import { roomExists, saveRoom, storeMode } from "@/lib/store";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { nickname?: string };
  const nickname = displayNickname(body.nickname, user, "Anfitrião");
  const playerId = user.id;

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
