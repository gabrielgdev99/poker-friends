import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { DefaultSession } from "next-auth";
import { isAdminEmail } from "@/lib/admin";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; isAdmin: boolean };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/",
  },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account && profile && "sub" in profile && profile.sub) {
        token.sub = profile.sub;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.isAdmin = isAdminEmail(session.user.email);
      }
      return session;
    },
  },
});
