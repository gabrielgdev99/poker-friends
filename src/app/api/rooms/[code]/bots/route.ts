import { NextResponse } from "next/server";
import { canManageBots } from "@/lib/can-manage-bots";
import { addBot, advanceBots, removeBot } from "@/lib/poker/bots";
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
  if (!canManageBots(user, room)) {
    return NextResponse.json({ error: "Só o anfitrião adiciona bots" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    botId?: string;
  };

  try {
    if (body.action === "remove") {
      if (!body.botId) {
        return NextResponse.json({ error: "botId obrigatório" }, { status: 400 });
      }
      removeBot(room, body.botId);
    } else {
      addBot(room);
    }
    await saveRoom(room);
    return NextResponse.json({ room: toPublicRoom(room, user.id) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}

/** Trigger bot turns (also used by clients if needed). */
export async function PUT(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }
  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  if (advanceBots(room)) await saveRoom(room);
  return NextResponse.json({ room: toPublicRoom(room, user.id) });
}
