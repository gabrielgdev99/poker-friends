import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listRooms, storeMode } from "@/lib/store";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const rooms = await listRooms();
  return NextResponse.json({
    store: storeMode(),
    rooms: rooms.map((r) => ({
      code: r.code,
      status: r.status,
      handNumber: r.handNumber,
      pot: r.pot,
      street: r.street,
      playerCount: r.players.length,
      seatedCount: r.players.filter((p) => p.seat !== null).length,
      players: r.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        seat: p.seat,
        chips: p.chips,
      })),
      hostId: r.hostId,
      lastAction: r.lastAction,
      updatedAt: r.updatedAt,
    })),
  });
}
