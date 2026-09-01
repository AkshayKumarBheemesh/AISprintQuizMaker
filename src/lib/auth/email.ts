/**
 * The only place email is normalized. Both the write path and the lookup path must
 * call this, or the unique index on `users.email` is silently bypassed.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
