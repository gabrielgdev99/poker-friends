import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Health/store probe stays public
  if (pathname === "/api/rooms" && req.method === "GET") {
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

  const needsAuth =
    pathname.startsWith("/sala/") ||
    pathname.startsWith("/api/rooms") ||
    pathname.startsWith("/api/profile");

  if (needsAuth && !req.auth) {
    if (pathname.startsWith("/sala/")) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("login", "1");
      return NextResponse.redirect(url);
    }
    return NextResponse.json({ error: "Faça login com Google" }, { status: 401 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/sala/:path*",
    "/api/rooms",
    "/api/rooms/:path*",
    "/api/profile",
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
