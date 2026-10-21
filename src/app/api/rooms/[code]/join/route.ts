import { NextResponse } from "next/server";
import { BUY_IN, GUEST_STACK, withdraw } from "@/lib/bank";
import { joinRoom } from "@/lib/poker/engine";
import { getProfile } from "@/lib/profile";
import { toPublicRoom } from "@/lib/public-room";
import { displayNickname, requireUser } from "@/lib/require-user";
import { getRoom, saveRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: "Faça login com Google ou continue como convidado" },
      { status: 401 },
    );
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
      user.isGuest ? "Convidado" : "Jogador",
    );

    const existing = room.players.find((p) => p.id === user.id);
    const isNew = !existing;
    const stack = user.isGuest ? GUEST_STACK : BUY_IN;
    let bankBalance: number | null = null;

    // New Google players: withdraw buy-in. Returning players keep table chips.
    if (isNew && !user.isGuest) {
      try {
        const bank = await withdraw(user.id, stack);
        bankBalance = bank.balance;
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Banco insuficiente" },
          { status: 400 },
        );
      }
    }

    joinRoom(room, user.id, nickname, {
      emoji: profile.emoji,
      chipColor: profile.chipColor,
    });
    const me = room.players.find((p) => p.id === user.id);
    if (me && isNew) {
      me.chips = stack;
    }

    await saveRoom(room);
    return NextResponse.json({
      playerId: user.id,
      room: toPublicRoom(room, user.id),
      buyIn: isNew ? stack : 0,
      bankBalance,
      isGuest: user.isGuest,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg.includes("Redis") ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
