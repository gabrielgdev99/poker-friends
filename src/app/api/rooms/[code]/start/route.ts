import { NextResponse } from "next/server";
import { canManageBots } from "@/lib/can-manage-bots";
import { prepareRematch, startHand } from "@/lib/poker/engine";
import { tickRoom } from "@/lib/poker/turn";
import { toPublicRoom } from "@/lib/public-room";
import { requireUser } from "@/lib/require-user";
import { getRoom, saveRoom } from "@/lib/store";

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
  if (!canManageBots(user, room)) {
    return NextResponse.json(
      { error: "Só o anfitrião (ou admin) inicia a mão" },
      { status: 403 },
    );
  }
  try {
    // Prefer rematch prep when table just ended (keeps code/settings)
    if (room.tableEnded) {
      prepareRematch(room);
    }
    startHand(room, room.hostId);
    tickRoom(room);
    await saveRoom(room);
    return NextResponse.json({ room: toPublicRoom(room, user.id) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
