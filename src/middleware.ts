import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { GUEST_COOKIE, isValidGuestId } from "@/lib/guest";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Health/store probe stays public
  if (pathname === "/api/rooms" && req.method === "GET") {
    return NextResponse.next();
  }

  // Guest bootstrap always public
  if (pathname === "/api/guest") {
    return NextResponse.next();
  }

  const isAdminPath =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminPath) {
    if (!req.auth) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("login", "1");
      return NextResponse.redirect(url);
    }
    if (!isAdminEmail(req.auth.user?.email)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  const guestId = req.cookies.get(GUEST_COOKIE)?.value;
  const hasGuest = isValidGuestId(guestId);

  const needsAuth =
    pathname.startsWith("/sala/") ||
    pathname.startsWith("/api/rooms") ||
    pathname.startsWith("/api/profile") ||
    pathname.startsWith("/api/bank");

  if (needsAuth && !req.auth && !hasGuest) {
    if (pathname.startsWith("/sala/")) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("login", "1");
      return NextResponse.redirect(url);
    }
    return NextResponse.json(
      { error: "Faça login com Google ou continue como convidado" },
      { status: 401 },
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/sala/:path*",
    "/api/rooms",
    "/api/rooms/:path*",
    "/api/profile",
    "/api/bank",
    "/api/guest",
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
