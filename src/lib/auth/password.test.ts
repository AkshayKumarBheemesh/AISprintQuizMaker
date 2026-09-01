import { describe, expect, it } from "vitest";

import { PBKDF2_ITERATIONS, hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
	it("U-2: encodes the hash as pbkdf2$iterations$salt$hash", async () => {
		const stored = await hashPassword("correct horse battery staple");
		const parts = stored.split("$");

		expect(parts).toHaveLength(4);
		expect(parts[0]).toBe("pbkdf2");
		expect(Number(parts[1])).toBe(PBKDF2_ITERATIONS);
		expect(parts[2].length).toBeGreaterThan(0);
		expect(parts[3].length).toBeGreaterThan(0);
	});

	it("U-4: uses exactly 100,000 iterations, the workerd ceiling", async () => {
		expect(PBKDF2_ITERATIONS).toBe(100_000);

		const stored = await hashPassword("any password");
		expect(stored.split("$")[1]).toBe("100000");
	});

	it("U-3: never embeds the plaintext password in the stored value", async () => {
		const password = "SuperSecret123";
		const stored = await hashPassword(password);

		expect(stored).not.toContain(password);
	});

	it("U-5: derives a different salt and hash for identical passwords", async () => {
		const first = await hashPassword("same-password");
		const second = await hashPassword("same-password");

		expect(first.split("$")[2]).not.toBe(second.split("$")[2]);
		expect(first.split("$")[3]).not.toBe(second.split("$")[3]);
	});

	it("encodes salt and hash as unpadded base64url", async () => {
		const [, , salt, hash] = (await hashPassword("x")).split("$");

		expect(salt).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe("verifyPassword", () => {
	it("accepts the correct password", async () => {
		const stored = await hashPassword("correct-password");

		await expect(verifyPassword("correct-password", stored)).resolves.toBe(true);
	});

	it("rejects an incorrect password", async () => {
		const stored = await hashPassword("correct-password");

		await expect(verifyPassword("wrong-password", stored)).resolves.toBe(false);
	});

	it("rejects a password that differs only in case", async () => {
		const stored = await hashPassword("CaseSensitive");

		await expect(verifyPassword("casesensitive", stored)).resolves.toBe(false);
	});

	it("rejects a tampered hash segment without throwing", async () => {
		const stored = await hashPassword("correct-password");
		const [prefix, iterations, salt] = stored.split("$");
		const tampered = [prefix, iterations, salt, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"].join("$");

		await expect(verifyPassword("correct-password", tampered)).resolves.toBe(false);
	});

	it.each([
		["empty string", ""],
		["wrong segment count", "pbkdf2$100000$onlythree"],
		["unknown algorithm", "scrypt$100000$c2FsdA$aGFzaA"],
		["non-numeric iterations", "pbkdf2$abc$c2FsdA$aGFzaA"],
	])("rejects a malformed stored hash (%s) without throwing", async (_label, stored) => {
		await expect(verifyPassword("any-password", stored)).resolves.toBe(false);
	});
});
