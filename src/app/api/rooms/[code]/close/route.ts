import { NextResponse } from "next/server";
import { canManageBots } from "@/lib/can-manage-bots";
import { deposit } from "@/lib/bank";
import { requireUser } from "@/lib/require-user";
import { deleteRoom, getRoom } from "@/lib/store";

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

  // Refund Google players' table chips before wipe
  for (const p of room.players) {
    if (p.isBot || p.id.startsWith("guest_")) continue;
    if (p.chips > 0) {
      try {
        await deposit(p.id, p.chips);
      } catch {
        /* best effort */
      }
    }
  }

  await deleteRoom(room.code);
  return NextResponse.json({ ok: true, closed: true, code: room.code });
}
