import { NextResponse } from "next/server";
import { getLeaderboards } from "@/lib/stats";

export async function GET() {
  try {
    const boards = await getLeaderboards(25);
    return NextResponse.json(boards);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao ler ranking" },
      { status: 503 },
    );
  }
}
