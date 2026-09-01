import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/d1-client", () => ({
	queryAll: vi.fn(),
	queryOne: vi.fn(),
	execute: vi.fn(),
}));

import {
	DUPLICATE_EMAIL_MESSAGE,
	INVALID_CREDENTIALS_MESSAGE,
} from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import { execute, queryOne } from "@/lib/d1-client";

import { loginUser, registerUser } from "./auth-service";

const mockQueryOne = vi.mocked(queryOne);
const mockExecute = vi.mocked(execute);

const PASSWORD = "correct-password";
let passwordHash: string;

beforeAll(async () => {
	passwordHash = await hashPassword(PASSWORD);
});

beforeEach(() => {
	vi.clearAllMocks();
	mockExecute.mockResolvedValue(undefined as never);
});

function uniqueEmailViolation() {
	return new Error(
		"D1_ERROR: UNIQUE constraint failed: users.email: SQLITE_CONSTRAINT_UNIQUE",
	);
}

function validInput(overrides: Record<string, string> = {}) {
	return {
		firstName: "Ada",
		lastName: "Lovelace",
		email: "ada@school.org",
		password: PASSWORD,
		...overrides,
	};
}

describe("registerUser", () => {
	it("U-1: creates the user and returns it on success", async () => {
		const result = await registerUser(validInput());

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.user).toMatchObject({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.org",
		});
		expect(result.user.id).toBeTruthy();
	});

	it("U-1: never returns a password hash to the caller", async () => {
		const result = await registerUser(validInput());

		expect(JSON.stringify(result)).not.toContain("pbkdf2");
	});

	it("U-2: persists a PBKDF2-encoded hash", async () => {
		await registerUser(validInput());

		const [, params = []] = mockExecute.mock.calls[0];
		const stored = params.find(
			(value): value is string => typeof value === "string" && value.startsWith("pbkdf2$"),
		);

		expect(stored).toBeDefined();
		expect(stored).toMatch(/^pbkdf2\$100000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
	});

	it("U-3: never passes the plaintext password to the database", async () => {
		await registerUser(validInput());

		const [sql, params] = mockExecute.mock.calls[0];
		expect(sql).not.toContain(PASSWORD);
		expect(params).not.toContain(PASSWORD);
		expect(JSON.stringify(params)).not.toContain(PASSWORD);
	});

	it("U-6: rejects a duplicate email with the specified message", async () => {
		mockExecute.mockRejectedValue(uniqueEmailViolation());

		const result = await registerUser(validInput());

		expect(result).toEqual({ ok: false, error: "DUPLICATE_EMAIL" });
		expect(DUPLICATE_EMAIL_MESSAGE).toBe("An account with this email already exists.");
	});

	it("U-6: treats a unique index on lower(email) as the same duplicate", async () => {
		mockExecute.mockRejectedValue(
			new Error(
				"UNIQUE constraint failed: index 'idx_users_email': SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)",
			),
		);

		await expect(registerUser(validInput())).resolves.toEqual({
			ok: false,
			error: "DUPLICATE_EMAIL",
		});
	});

	it("U-6: relies on the database constraint rather than a check-then-insert read", async () => {
		await registerUser(validInput());

		expect(mockQueryOne).not.toHaveBeenCalled();
	});

	it("U-6: does not swallow unrelated database errors", async () => {
		mockExecute.mockRejectedValue(new Error("D1_ERROR: no such table: users"));

		await expect(registerUser(validInput())).rejects.toThrow("no such table");
	});

	it("U-7: trims and lowercases the email before storing it", async () => {
		await registerUser(validInput({ email: "  Ada@School.ORG  " }));

		const [, params] = mockExecute.mock.calls[0];
		expect(params).toContain("ada@school.org");
		expect(params).not.toContain("  Ada@School.ORG  ");
	});

	it("U-20: inserts using positional placeholders, never interpolated values", async () => {
		await registerUser(validInput());

		const [sql, params = []] = mockExecute.mock.calls[0];
		expect(sql).toContain("?1");
		expect(sql).toContain("?5");
		expect(sql).not.toContain("ada@school.org");
		expect(sql).not.toContain("Lovelace");
		expect(params.length).toBeGreaterThanOrEqual(5);
	});
});

describe("loginUser", () => {
	function storedUserRow(overrides: Record<string, unknown> = {}) {
		return {
			id: "user-1",
			first_name: "Ada",
			last_name: "Lovelace",
			email: "ada@school.org",
			password_hash: passwordHash,
			...overrides,
		};
	}

	it("U-9: authenticates a user with correct credentials", async () => {
		mockQueryOne.mockResolvedValue(storedUserRow());

		const result = await loginUser({ email: "ada@school.org", password: PASSWORD });

		expect(result).toEqual({
			ok: true,
			user: {
				id: "user-1",
				firstName: "Ada",
				lastName: "Lovelace",
				email: "ada@school.org",
			},
		});
	});

	it("U-9: never returns the password hash", async () => {
		mockQueryOne.mockResolvedValue(storedUserRow());

		const result = await loginUser({ email: "ada@school.org", password: PASSWORD });

		expect(JSON.stringify(result)).not.toContain("pbkdf2");
	});

	it("U-10: rejects an incorrect password", async () => {
		mockQueryOne.mockResolvedValue(storedUserRow());

		const result = await loginUser({ email: "ada@school.org", password: "wrong-password" });

		expect(result).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
	});

	it("U-11: rejects an unknown email", async () => {
		mockQueryOne.mockResolvedValue(null);

		const result = await loginUser({ email: "nobody@school.org", password: PASSWORD });

		expect(result).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
	});

	it("U-12: returns an identical error for a wrong password and an unknown email", async () => {
		mockQueryOne.mockResolvedValue(storedUserRow());
		const wrongPassword = await loginUser({ email: "ada@school.org", password: "nope" });

		mockQueryOne.mockResolvedValue(null);
		const unknownEmail = await loginUser({ email: "nobody@school.org", password: PASSWORD });

		expect(wrongPassword).toEqual(unknownEmail);
		expect(INVALID_CREDENTIALS_MESSAGE).toBe("Incorrect email or password.");
	});

	it("U-12: performs a hash derivation even when no user is found, to level timing", async () => {
		mockQueryOne.mockResolvedValue(null);
		const start = performance.now();

		await loginUser({ email: "nobody@school.org", password: PASSWORD });

		expect(performance.now() - start).toBeGreaterThan(5);
	});

	it("U-8: normalizes the email before looking it up", async () => {
		mockQueryOne.mockResolvedValue(storedUserRow());

		await loginUser({ email: "  Ada@School.ORG ", password: PASSWORD });

		const [, params] = mockQueryOne.mock.calls[0];
		expect(params).toEqual(["ada@school.org"]);
	});

	it("U-19: selects an explicit column list rather than SELECT *", async () => {
		mockQueryOne.mockResolvedValue(storedUserRow());

		await loginUser({ email: "ada@school.org", password: PASSWORD });

		const [sql] = mockQueryOne.mock.calls[0];
		expect(sql).not.toContain("*");
	});

	it("U-20: looks up using positional placeholders", async () => {
		mockQueryOne.mockResolvedValue(storedUserRow());

		await loginUser({ email: "ada@school.org", password: PASSWORD });

		const [sql] = mockQueryOne.mock.calls[0];
		expect(sql).toContain("?1");
		expect(sql).not.toContain("ada@school.org");
	});
});
