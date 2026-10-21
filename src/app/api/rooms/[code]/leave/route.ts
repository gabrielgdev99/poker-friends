import { NextResponse } from "next/server";
import { leaveRoom } from "@/lib/poker/engine";
import { requireUser } from "@/lib/require-user";
import { deleteRoom, getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }
  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  if (!room.players.some((p) => p.id === user.id)) {
    return NextResponse.json({ ok: true, left: true, empty: false });
  }

  try {
    leaveRoom(room, user.id);
    if (room.players.length === 0 || room.players.every((p) => p.isBot)) {
      await deleteRoom(room.code);
      return NextResponse.json({ ok: true, left: true, empty: true });
    }
    await saveRoom(room);
    return NextResponse.json({ ok: true, left: true, empty: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao sair" },
      { status: 400 },
    );
  }
}
