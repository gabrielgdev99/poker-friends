import { NextResponse } from "next/server";
import { toPublicRoom } from "@/lib/public-room";
import { tickRoom } from "@/lib/poker/turn";
import { requireUser } from "@/lib/require-user";
import { getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }

  const { code } = await ctx.params;
  try {
    const room = await getRoom(code);
    if (!room) {
      return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
    }
    if (tickRoom(room)) await saveRoom(room);
    return NextResponse.json({ room: toPublicRoom(room, user.id) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao ler sala" },
      { status: 503 },
    );
  }
}
