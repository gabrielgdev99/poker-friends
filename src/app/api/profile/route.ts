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
  // Only forward defined fields — undefined must NOT wipe other prefs
  const patch: Partial<UserProfile> = {};
  if (typeof body.nickname === "string") patch.nickname = body.nickname;
  if (typeof body.emoji === "string") patch.emoji = body.emoji;
  if (typeof body.chipColor === "string") patch.chipColor = body.chipColor;
  if (typeof body.feltAccent === "string") {
    patch.feltAccent = body.feltAccent as FeltAccent;
  }
  const profile = await saveProfile(user.id, patch, user.name);
  return NextResponse.json({ profile });
}
