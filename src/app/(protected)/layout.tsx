import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SESSION_CLEAR_PATH } from "@/lib/auth-constants";
import { getCurrentUser } from "@/lib/session";

/**
 * Layer 2, and the authoritative one. Middleware only checks that a cookie exists; this
 * resolves it against D1, so forged and expired sessions are rejected here.
 *
 * Redirect goes to the cookie-clearing Route Handler, not /login. Clearing from this
 * Server Component is forbidden and throws; leaving the cookie makes middleware bounce
 * /login back to /dashboard.
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
	const user = await getCurrentUser();

	if (!user) {
		redirect(SESSION_CLEAR_PATH);
	}

	return <>{children}</>;
}
