import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const PROTECTED_PREFIX = "/dashboard";
const AUTH_ROUTES = ["/login", "/register"];

/**
 * Layer 1 of route protection: a cookie-presence fast path, not a security boundary. It
 * stays synchronous and never queries D1, because it runs on every matched request. A
 * forged cookie passes here and is rejected by `getCurrentUser()` in the protected
 * layout, which is the authoritative check.
 */
export function middleware(request: NextRequest): NextResponse {
	const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
	const { pathname } = request.nextUrl;

	if (!hasSessionCookie && pathname.startsWith(PROTECTED_PREFIX)) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	if (hasSessionCookie && AUTH_ROUTES.includes(pathname)) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard", "/dashboard/:path*", "/login", "/register"],
};
