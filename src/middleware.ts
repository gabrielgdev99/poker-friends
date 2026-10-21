import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Health/store probe stays public
  if (pathname === "/api/rooms" && req.method === "GET") {
    return NextResponse.next();
  }

  const needsAuth =
    pathname.startsWith("/sala/") || pathname.startsWith("/api/rooms");

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
  matcher: ["/sala/:path*", "/api/rooms", "/api/rooms/:path*"],
};
