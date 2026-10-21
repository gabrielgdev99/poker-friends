import { NextResponse } from "next/server";
import { canManageBots } from "@/lib/can-manage-bots";
import { prepareRematch, seatedPlayers, startHand } from "@/lib/poker/engine";
import { tickRoom } from "@/lib/poker/turn";
import { toPublicRoom } from "@/lib/public-room";
import { requireUser } from "@/lib/require-user";
import { getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Host/admin: “Jogar de novo” — same room code, fresh stacks, lobby.
 * If 2+ already seated, starts a hand. Does not delete the room.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google ou continue como convidado" }, { status: 401 });
  }

  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  if (!canManageBots(user, room)) {
    return NextResponse.json(
      { error: "Só o anfitrião (ou admin) pode jogar de novo" },
      { status: 403 },
    );
  }
  if (!room.tableEnded) {
    return NextResponse.json(
      { error: "A mesa ainda não acabou — espere o campeão" },
      { status: 400 },
    );
  }

  try {
    prepareRematch(room);
    let started = false;
    if (seatedPlayers(room).length >= 2) {
      try {
        startHand(room, room.hostId);
        tickRoom(room);
        started = true;
      } catch {
        // Lobby: waiting for seats — OK
      }
    }
    await saveRoom(room);
    return NextResponse.json({
      room: toPublicRoom(room, user.id),
      started,
      message: started
        ? "Nova mão — a paz do Senhor e boa sorte!"
        : "Mesa pronta — sentem pelo menos 2 e o anfitrião inicia a mão.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
