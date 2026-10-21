import { NextResponse } from "next/server";
import { applyAction } from "@/lib/poker/engine";
import { toPublicRoom } from "@/lib/public-room";
import type { PlayerAction } from "@/lib/types";
import { getRoom, saveRoom } from "@/lib/store";


type Ctx = { params: Promise<{ code: string }> };

const ACTIONS: PlayerAction[] = ["fold", "check", "call", "bet", "raise"];

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  const body = (await req.json()) as {
    playerId?: string;
    action?: string;
    amount?: number;
  };
  if (!body.playerId || !body.action || !ACTIONS.includes(body.action as PlayerAction)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }
  try {
    applyAction(room, body.playerId, body.action as PlayerAction, body.amount);
    await saveRoom(room);
    return NextResponse.json({ room: toPublicRoom(room, body.playerId) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
