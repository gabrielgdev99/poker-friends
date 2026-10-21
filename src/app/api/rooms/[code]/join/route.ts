import { NextResponse } from "next/server";
import { randomId } from "@/lib/codes";
import { joinRoom } from "@/lib/poker/engine";
import { toPublicRoom } from "@/lib/public-room";
import { getRoom, saveRoom } from "@/lib/store";


type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    nickname?: string;
    playerId?: string;
  };
  const playerId = body.playerId || randomId();
  const nickname = (body.nickname ?? "Jogador").slice(0, 16);

  try {
    joinRoom(room, playerId, nickname);
    await saveRoom(room);
    return NextResponse.json({ playerId, room: toPublicRoom(room, playerId) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
