import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/d1-client", () => ({
	queryAll: vi.fn(),
	queryOne: vi.fn(),
	execute: vi.fn(),
}));

import { execute, queryOne } from "@/lib/d1-client";

import {
	SESSION_DURATION_SECONDS,
	createSession,
	deleteSession,
	getSessionUser,
} from "./session";

const mockQueryOne = vi.mocked(queryOne);
const mockExecute = vi.mocked(execute);

const NOW_SECONDS = 1_756_700_000;

function sessionRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "user-1",
		first_name: "Ada",
		last_name: "Lovelace",
		email: "ada@school.org",
		expires_at: NOW_SECONDS + SESSION_DURATION_SECONDS,
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(NOW_SECONDS * 1000);
	mockExecute.mockResolvedValue(undefined as never);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("createSession", () => {
	it("U-13: sets an absolute expiry of exactly 7 days", async () => {
		const session = await createSession("user-1");

		expect(SESSION_DURATION_SECONDS).toBe(604_800);
		expect(session.expiresAt).toBe(NOW_SECONDS + 604_800);
	});

	it("U-13: generates a unique, opaque identifier on every call", async () => {
		const ids = new Set<string>();
		for (let i = 0; i < 25; i += 1) {
			ids.add((await createSession("user-1")).id);
		}

		expect(ids.size).toBe(25);
	});

	it("U-13: derives the identifier from neither the user id nor the timestamp", async () => {
		const session = await createSession("user-1");

		expect(session.id).not.toContain("user-1");
		expect(session.id).not.toContain(String(NOW_SECONDS));
		expect(session.id.length).toBeGreaterThanOrEqual(32);
	});

	it("U-20: inserts using positional placeholders, never interpolated values", async () => {
		await createSession("user-1");

		const [sql, params] = mockExecute.mock.calls[0];
		expect(sql).toContain("?1");
		expect(sql).not.toContain("user-1");
		expect(params).toContain("user-1");
	});
});

describe("getSessionUser", () => {
	it("U-14: returns the user for a valid, unexpired session", async () => {
		mockQueryOne.mockResolvedValue(sessionRow());

		await expect(getSessionUser("session-abc")).resolves.toEqual({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.org",
		});
	});

	it("U-15: returns null for an expired session", async () => {
		mockQueryOne.mockResolvedValue(sessionRow({ expires_at: NOW_SECONDS - 1 }));

		await expect(getSessionUser("session-abc")).resolves.toBeNull();
	});

	it("U-15: deletes the row when it encounters an expired session", async () => {
		mockQueryOne.mockResolvedValue(sessionRow({ expires_at: NOW_SECONDS - 1 }));

		await getSessionUser("session-abc");

		expect(mockExecute).toHaveBeenCalledTimes(1);
		const [sql, params] = mockExecute.mock.calls[0];
		expect(sql).toContain("DELETE");
		expect(params).toContain("session-abc");
	});

	it("U-15: treats a session expiring exactly now as expired", async () => {
		mockQueryOne.mockResolvedValue(sessionRow({ expires_at: NOW_SECONDS }));

		await expect(getSessionUser("session-abc")).resolves.toBeNull();
	});

	it("U-16: returns null for an unknown session id without throwing", async () => {
		mockQueryOne.mockResolvedValue(null);

		await expect(getSessionUser("does-not-exist")).resolves.toBeNull();
	});

	it.each([
		["empty string", ""],
		["whitespace", "   "],
	])("U-16: returns null for a malformed session id (%s) without querying", async (_label, id) => {
		await expect(getSessionUser(id)).resolves.toBeNull();
		expect(mockQueryOne).not.toHaveBeenCalled();
	});

	it("U-19: never exposes password_hash", async () => {
		mockQueryOne.mockResolvedValue(sessionRow({ password_hash: "pbkdf2$100000$salt$hash" }));

		const user = await getSessionUser("session-abc");

		expect(user).not.toHaveProperty("password_hash");
		expect(JSON.stringify(user)).not.toContain("pbkdf2");
	});

	it("U-19: selects an explicit column list rather than SELECT *", async () => {
		mockQueryOne.mockResolvedValue(sessionRow());

		await getSessionUser("session-abc");

		const [sql] = mockQueryOne.mock.calls[0];
		expect(sql).not.toContain("*");
		expect(sql).not.toContain("password_hash");
	});

	it("U-20: looks up using positional placeholders", async () => {
		mockQueryOne.mockResolvedValue(sessionRow());

		await getSessionUser("session-abc");

		const [sql, params] = mockQueryOne.mock.calls[0];
		expect(sql).toContain("?1");
		expect(sql).not.toContain("session-abc");
		expect(params).toEqual(["session-abc"]);
	});
});

describe("deleteSession", () => {
	it("U-17: deletes the row for the given session id", async () => {
		await deleteSession("session-abc");

		const [sql, params] = mockExecute.mock.calls[0];
		expect(sql).toContain("DELETE FROM sessions");
		expect(params).toEqual(["session-abc"]);
	});

	it("U-17: a deleted session no longer resolves to a user", async () => {
		await deleteSession("session-abc");
		mockQueryOne.mockResolvedValue(null);

		await expect(getSessionUser("session-abc")).resolves.toBeNull();
	});

	it("U-18: deleting an already-deleted session succeeds silently", async () => {
		mockExecute.mockResolvedValue(undefined as never);

		await expect(deleteSession("already-gone")).resolves.toBeUndefined();
		await expect(deleteSession("already-gone")).resolves.toBeUndefined();
	});

	it("U-20: deletes using positional placeholders", async () => {
		await deleteSession("session-abc");

		const [sql] = mockExecute.mock.calls[0];
		expect(sql).toContain("?1");
		expect(sql).not.toContain("session-abc");
	});
});
