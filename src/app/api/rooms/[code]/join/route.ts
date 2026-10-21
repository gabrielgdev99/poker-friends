import { NextResponse } from "next/server";
import { joinRoom } from "@/lib/poker/engine";
import { getProfile } from "@/lib/profile";
import { toPublicRoom } from "@/lib/public-room";
import { displayNickname, requireUser } from "@/lib/require-user";
import { getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }

  const { code } = await ctx.params;
  try {
    const room = await getRoom(code);
    if (!room) {
      return NextResponse.json(
        {
          error:
            "Sala não encontrada. Se acabou de criar, o Redis pode não estar configurado na Vercel.",
        },
        { status: 404 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { nickname?: string };
    const profile = await getProfile(user.id, user.name);
    const nickname = displayNickname(
      body.nickname || profile.nickname,
      user,
      "Jogador",
    );

    joinRoom(room, user.id, nickname, {
      emoji: profile.emoji,
      chipColor: profile.chipColor,
    });
    await saveRoom(room);
    return NextResponse.json({ playerId: user.id, room: toPublicRoom(room, user.id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg.includes("Redis") ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
