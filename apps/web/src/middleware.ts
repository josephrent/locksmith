import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdminCookie } from "@/lib/admin-auth";

const ADMIN_LOGIN = "/admin/login";
const COOKIE_NAME = "admin_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  if (pathname === ADMIN_LOGIN) {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SESSION_SECRET;
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  const valid = !!secret && (await verifyAdminCookie(cookie, secret));

  if (!valid) {
    const loginUrl = new URL(ADMIN_LOGIN, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
