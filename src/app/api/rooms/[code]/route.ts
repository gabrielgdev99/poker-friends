import { NextResponse } from "next/server";
import { toPublicRoom } from "@/lib/public-room";
import { getRoom } from "@/lib/store";


type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId") ?? undefined;
  return NextResponse.json({ room: toPublicRoom(room, playerId) });
}
