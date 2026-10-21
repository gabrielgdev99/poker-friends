import { NextResponse } from "next/server";
import { GUEST_COOKIE, isValidGuestId, newGuestId } from "@/lib/guest";

const MAX_AGE = 60 * 60 * 24 * 90;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    nickname?: string;
    guestId?: string;
  };
  const nickname = (body.nickname?.trim() || "Convidado").slice(0, 16);
  const id =
    isValidGuestId(body.guestId) ? body.guestId : newGuestId();

  const res = NextResponse.json({
    id,
    nickname,
    isGuest: true,
  });
  res.cookies.set(GUEST_COOKIE, id, {
    httpOnly: false, // readable by client for sync
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GUEST_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
