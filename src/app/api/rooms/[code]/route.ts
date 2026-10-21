import { NextResponse } from "next/server";
import { advanceBots } from "@/lib/poker/bots";
import { toPublicRoom } from "@/lib/public-room";
import { requireUser } from "@/lib/require-user";
import { getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }

  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  // Server-side bot turns on every poll so the hand never hangs
  if (advanceBots(room)) await saveRoom(room);
  return NextResponse.json({ room: toPublicRoom(room, user.id) });
}
