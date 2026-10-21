import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import type { AuthUser } from "@/lib/require-user";

export async function requireAdmin(): Promise<AuthUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !isAdminEmail(email)) return null;
  return {
    id,
    name: session.user?.name,
    email,
    image: session.user?.image,
    isGuest: false,
  };
}
