import { cookies } from "next/headers";
import { auth } from "@/auth";
import { GUEST_COOKIE, isValidGuestId } from "@/lib/guest";

export type AuthUser = {
  id: string;
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  isGuest: boolean;
};

export async function requireUser(): Promise<AuthUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (id) {
    return {
      id,
      name: session.user?.name,
      email: session.user?.email,
      image: session.user?.image,
      isGuest: false,
    };
  }

  const jar = await cookies();
  const guestId = jar.get(GUEST_COOKIE)?.value;
  if (isValidGuestId(guestId)) {
    return {
      id: guestId,
      name: "Convidado",
      email: null,
      image: null,
      isGuest: true,
    };
  }

  return null;
}

export function displayNickname(
  preferred: string | undefined,
  user: AuthUser,
  fallback: string,
): string {
  const fromPreferred = preferred?.trim();
  if (fromPreferred) return fromPreferred.slice(0, 16);
  const fromGoogle = user.name?.trim();
  if (fromGoogle && !user.isGuest) return fromGoogle.slice(0, 16);
  if (user.isGuest) return (fromPreferred || "Convidado").slice(0, 16);
  return fallback.slice(0, 16);
}
