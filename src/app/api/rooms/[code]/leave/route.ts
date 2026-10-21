import { NextResponse } from "next/server";
import { deposit } from "@/lib/bank";
import { leaveRoom } from "@/lib/poker/engine";
import { requireUser } from "@/lib/require-user";
import { getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Player leaves the room. Room ALWAYS stays open for others.
 * Never deletes the room — use Encerrar mesa for that.
 * If only bots remain, room stays until host/admin ends it or Redis TTL.
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
  const me = room.players.find((p) => p.id === user.id);
  if (!me) {
    return NextResponse.json({
      ok: true,
      left: true,
      chipsReturned: 0,
      bankBalance: null,
    });
  }

  const chipsReturned = Math.max(0, me.chips);

  try {
    leaveRoom(room, user.id);

    let bankBalance: number | null = null;
    if (!user.isGuest && chipsReturned > 0) {
      const bank = await deposit(user.id, chipsReturned);
      bankBalance = bank.balance;
    }

    // Always persist — never deleteRoom here
    await saveRoom(room);

    return NextResponse.json({
      ok: true,
      left: true,
      chipsReturned,
      bankBalance,
      isGuest: user.isGuest,
      roomStillOpen: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao sair" },
      { status: 400 },
    );
  }
}
