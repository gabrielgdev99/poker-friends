import { NextResponse } from "next/server";
import { getProfile, PROFILE_OPTIONS, saveProfile } from "@/lib/profile";
import { requireUser } from "@/lib/require-user";
import type { FeltAccent, UserProfile } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }
  const profile = await getProfile(user.id, user.name);
  return NextResponse.json({ profile, options: PROFILE_OPTIONS });
}

export async function PUT(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<UserProfile>;
  const profile = await saveProfile(
    user.id,
    {
      nickname: body.nickname,
      emoji: body.emoji,
      chipColor: body.chipColor,
      feltAccent: body.feltAccent as FeltAccent | undefined,
    },
    user.name,
  );
  return NextResponse.json({ profile });
}
