import { NextResponse } from "next/server";
import { sitDown } from "@/lib/poker/engine";
import { toPublicRoom } from "@/lib/public-room";
import { requireUser } from "@/lib/require-user";
import { getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }

  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  const body = (await req.json()) as { seat?: number };
  if (body.seat === undefined) {
    return NextResponse.json({ error: "seat obrigatório" }, { status: 400 });
  }
  try {
    sitDown(room, user.id, body.seat);
    await saveRoom(room);
    return NextResponse.json({ room: toPublicRoom(room, user.id) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
