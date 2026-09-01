import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

/**
 * Cookie mutation is not allowed in Server Components. An invalid session therefore
 * cannot be cleared inside `getCurrentUser()`. This handler is the allowed place:
 * expire the cookie on the response, then send the browser to /login so middleware
 * does not bounce it back to /dashboard.
 */
export function GET(request: Request): NextResponse {
	const response = NextResponse.redirect(new URL("/login", request.url));
	response.cookies.delete({ name: SESSION_COOKIE_NAME, path: "/" });
	return response;
}
