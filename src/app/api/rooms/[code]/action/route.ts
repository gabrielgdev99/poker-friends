import { NextResponse } from "next/server";
import { advanceBots } from "@/lib/poker/bots";
import { applyAction } from "@/lib/poker/engine";
import { toPublicRoom } from "@/lib/public-room";
import { requireUser } from "@/lib/require-user";
import type { PlayerAction } from "@/lib/types";
import { getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

const ACTIONS: PlayerAction[] = ["fold", "check", "call", "bet", "raise"];

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
  const body = (await req.json()) as {
    action?: string;
    amount?: number;
  };
  if (!body.action || !ACTIONS.includes(body.action as PlayerAction)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }
  try {
    applyAction(room, user.id, body.action as PlayerAction, body.amount);
    advanceBots(room);
    await saveRoom(room);
    return NextResponse.json({ room: toPublicRoom(room, user.id) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
