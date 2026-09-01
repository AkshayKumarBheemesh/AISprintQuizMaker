import { cookies } from "next/headers";

import { getSessionUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

/**
 * The authorization primitive. Cookie presence alone is never sufficient: the session is
 * resolved against D1, so a forged or expired cookie yields null and the caller must
 * treat the request as logged out.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
	const cookieStore = await cookies();
	const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

	if (!sessionId) {
		return null;
	}

	const user = await getSessionUser(sessionId);
	if (!user) {
		return null;
	}

	return user;
}
