import { auth } from "@/auth";

export type AuthUser = {
  id: string;
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
};

export async function requireUser(): Promise<AuthUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return {
    id,
    name: session.user?.name,
    email: session.user?.email,
    image: session.user?.image,
  };
}

export function displayNickname(
  preferred: string | undefined,
  user: AuthUser,
  fallback: string,
): string {
  const fromPreferred = preferred?.trim();
  if (fromPreferred) return fromPreferred.slice(0, 16);
  const fromGoogle = user.name?.trim();
  if (fromGoogle) return fromGoogle.slice(0, 16);
  return fallback.slice(0, 16);
}
