import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ADMIN_PATHS = [
  "/dashboard",
  "/reservations",
  "/calendar",
  "/courses",
  "/instructors",
  "/accommodation",
  "/customers",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Public routes — no auth needed
  if (
    pathname === "/chat-demo" ||
    pathname === "/login" ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // Root "/" — ALWAYS redirect to /chat-demo (public landing)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/chat-demo", request.url));
  }

  // Admin paths — require cookie
  const auth = request.cookies.get("admin_auth")?.value;
  if (ADMIN_PASSWORD && auth === ADMIN_PASSWORD) {
    return NextResponse.next();
  }

  // Not authenticated → login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
