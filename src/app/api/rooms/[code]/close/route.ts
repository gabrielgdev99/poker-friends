import { NextResponse } from "next/server";
import { canManageBots } from "@/lib/can-manage-bots";
import { requireUser } from "@/lib/require-user";
import { getRoom, retireRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

/** Host/admin: Encerrar mesa — deletes room for everyone. */
export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  if (!canManageBots(user, room)) {
    return NextResponse.json(
      { error: "Só o anfitrião ou admin encerra a mesa" },
      { status: 403 },
    );
  }

  await retireRoom(room);
  return NextResponse.json({ ok: true, closed: true, code: room.code });
}
