import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { listRooms, storeMode } from "@/lib/store";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }

  const rooms = await listRooms();
  const active = rooms
    .filter((r) => r.players.some((p) => !p.isBot) || r.status !== "lobby" || r.handNumber > 0)
    .map((r) => {
      const host = r.players.find((p) => p.id === r.hostId);
      const humans = r.players.filter((p) => !p.isBot).length;
      const seated = r.players.filter((p) => p.seat !== null).length;
      return {
        code: r.code,
        status: r.status,
        smallBlind: r.smallBlind,
        bigBlind: r.bigBlind,
        playerCount: r.players.length,
        humanCount: humans,
        seatedCount: seated,
        maxSeats: r.maxSeats ?? 10,
        hostName: host ? `${host.emoji || ""} ${host.nickname}`.trim() : "—",
        handNumber: r.handNumber,
        updatedAt: r.updatedAt,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 40);

  return NextResponse.json({ store: storeMode(), rooms: active });
}
