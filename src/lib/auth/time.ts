/**
 * Single source of "now" for session expiry. Everything that writes or compares
 * `expires_at` must use this, so seconds are never compared against milliseconds.
 */
export function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}
