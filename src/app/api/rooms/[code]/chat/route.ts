import { NextResponse } from "next/server";
import { appendChat } from "@/lib/chat";
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
  if (!room.players.some((p) => p.id === user.id)) {
    return NextResponse.json({ error: "Entre na sala primeiro" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    kind?: "text" | "emoji";
  };
  const nick =
    room.players.find((p) => p.id === user.id)?.nickname ||
    user.name?.slice(0, 16) ||
    "Irmão";

  try {
    appendChat(room, {
      playerId: user.id,
      nickname: nick,
      text: body.text ?? "",
      kind: body.kind,
    });
    await saveRoom(room);
    return NextResponse.json({ room: toPublicRoom(room, user.id) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}
