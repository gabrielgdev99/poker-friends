import { NextResponse } from "next/server";
import { sitDown } from "@/lib/poker/engine";
import { toPublicRoom } from "@/lib/public-room";
import { getRoom, saveRoom } from "@/lib/store";


type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  const body = (await req.json()) as { playerId?: string; seat?: number };
  if (!body.playerId || body.seat === undefined) {
    return NextResponse.json({ error: "playerId e seat obrigatórios" }, { status: 400 });
  }
  try {
    sitDown(room, body.playerId, body.seat);
    await saveRoom(room);
    return NextResponse.json({ room: toPublicRoom(room, body.playerId) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
