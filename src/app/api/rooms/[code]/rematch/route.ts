import { NextResponse } from "next/server";
import { canManageBots } from "@/lib/can-manage-bots";
import { prepareRematch, seatedPlayers, startHand } from "@/lib/poker/engine";
import { tickRoom } from "@/lib/poker/turn";
import { toPublicRoom } from "@/lib/public-room";
import { requireUser } from "@/lib/require-user";
import { getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Host/admin: “Jogar de novo” — same room code, reseat everyone + bots,
 * fresh buy-in stacks, then start a hand if 2+ seated.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: "Faça login com Google ou continue como convidado" },
      { status: 401 },
    );
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
    const n = seatedPlayers(room).length;
    if (n >= 2) {
      try {
        startHand(room, room.hostId);
        tickRoom(room);
        started = true;
      } catch (e) {
        room.lastAction =
          e instanceof Error
            ? `Pronto pra jogar — ${e.message}`
            : "Pronto pra jogar — sentem e iniciem a mão.";
      }
    }
    await saveRoom(room);
    return NextResponse.json({
      room: toPublicRoom(room, user.id),
      started,
      seated: n,
      message: started
        ? "Nova mesa — a paz do Senhor e boa sorte!"
        : n < 2
          ? "Mesa resetada — precisa de pelo menos 2 sentados."
          : "Mesa resetada — toque em Iniciar mão no menu.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
