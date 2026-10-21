import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { deleteRoom, getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { code } = await ctx.params;
  const ok = await deleteRoom(code);
  if (!ok) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** Remove um jogador da sala (kick). Body: { playerId } */
export async function POST(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    playerId?: string;
  };
  if (body.action !== "kick" || !body.playerId) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }
  if (room.status === "playing") {
    return NextResponse.json(
      { error: "Não dá para expulsar no meio da mão" },
      { status: 400 },
    );
  }
  const before = room.players.length;
  room.players = room.players.filter((p) => p.id !== body.playerId);
  if (room.players.length === before) {
    return NextResponse.json({ error: "Jogador não está na sala" }, { status: 404 });
  }
  if (room.hostId === body.playerId) {
    room.hostId = room.players[0]?.id ?? room.hostId;
  }
  room.lastAction = `Admin expulsou um jogador`;
  await saveRoom(room);
  return NextResponse.json({ ok: true });
}
