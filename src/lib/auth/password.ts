import { fromBase64Url, toBase64Url } from "./base64url";

/**
 * workerd hard-rejects PBKDF2 above 100,000 iterations with NotSupportedError. Node has
 * no such cap, so a higher value passes every test here and then fails in production.
 * This is below OWASP's 600,000 recommendation and is a documented Workers limitation.
 */
export const PBKDF2_ITERATIONS = 100_000;

const PBKDF2_HASH = "SHA-256";
const SALT_BYTES = 16;
const KEY_BYTES = 32;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const derived = await deriveBits(password, salt, PBKDF2_ITERATIONS);

	return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split("$");
	if (parts.length !== 4 || parts[0] !== "pbkdf2") {
		return false;
	}

	const iterations = Number(parts[1]);
	if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) {
		return false;
	}

	let salt: Uint8Array<ArrayBuffer>;
	let expected: Uint8Array<ArrayBuffer>;
	try {
		salt = fromBase64Url(parts[2]);
		expected = fromBase64Url(parts[3]);
	} catch {
		return false;
	}

	if (salt.length === 0 || expected.length === 0) {
		return false;
	}

	const actual = await deriveBits(password, salt, iterations);
	return constantTimeEqual(actual, expected);
}

async function deriveBits(
	password: string,
	salt: Uint8Array<ArrayBuffer>,
	iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveBits"],
	);

	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: PBKDF2_HASH, salt, iterations },
		key,
		KEY_BYTES * 8,
	);

	return new Uint8Array(bits);
}

/**
 * `crypto.subtle.timingSafeEqual` is a Workers-only extension and does not exist in
 * Node, so comparison is done here instead.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let difference = 0;
	for (let i = 0; i < a.length; i += 1) {
		difference |= a[i] ^ b[i];
	}
	return difference === 0;
}
