import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore } = vi.hoisted(() => ({
	cookieStore: {
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth/session", () => ({
	getSessionUser: vi.fn(),
}));

import { getSessionUser } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

import { getCurrentUser } from "./session";

const mockGetSessionUser = vi.mocked(getSessionUser);

const AUTH_USER = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.org",
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getCurrentUser", () => {
	it("returns the user for a valid session cookie", async () => {
		cookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "session-abc" });
		mockGetSessionUser.mockResolvedValue(AUTH_USER);

		await expect(getCurrentUser()).resolves.toEqual(AUTH_USER);
		expect(mockGetSessionUser).toHaveBeenCalledWith("session-abc");
	});

	it("reads the quizmaker_session cookie by name", async () => {
		cookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "session-abc" });
		mockGetSessionUser.mockResolvedValue(AUTH_USER);

		await getCurrentUser();

		expect(cookieStore.get).toHaveBeenCalledWith("quizmaker_session");
	});

	it("returns null when no session cookie is present, without querying", async () => {
		cookieStore.get.mockReturnValue(undefined);

		await expect(getCurrentUser()).resolves.toBeNull();
		expect(mockGetSessionUser).not.toHaveBeenCalled();
	});

	it("returns null when the cookie is present but empty, without querying", async () => {
		cookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "" });

		await expect(getCurrentUser()).resolves.toBeNull();
		expect(mockGetSessionUser).not.toHaveBeenCalled();
	});

	it("treats an invalid session as logged out", async () => {
		cookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "forged-value" });
		mockGetSessionUser.mockResolvedValue(null);

		await expect(getCurrentUser()).resolves.toBeNull();
	});

	it("does not mutate cookies: this runs in Server Components, which cannot set cookies", async () => {
		cookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "forged-value" });
		mockGetSessionUser.mockResolvedValue(null);

		await getCurrentUser();

		expect(cookieStore.delete).not.toHaveBeenCalled();
		expect(cookieStore.set).not.toHaveBeenCalled();
	});

	it("does not clear the cookie for a valid session", async () => {
		cookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "session-abc" });
		mockGetSessionUser.mockResolvedValue(AUTH_USER);

		await getCurrentUser();

		expect(cookieStore.delete).not.toHaveBeenCalled();
	});

	it("treats an expired session as logged out", async () => {
		cookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "expired-session" });
		mockGetSessionUser.mockResolvedValue(null);

		await expect(getCurrentUser()).resolves.toBeNull();
	});

	it("never exposes a password hash or the session id", async () => {
		cookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "session-abc" });
		mockGetSessionUser.mockResolvedValue(AUTH_USER);

		const user = await getCurrentUser();

		expect(user).not.toHaveProperty("password_hash");
		expect(JSON.stringify(user)).not.toContain("session-abc");
	});
});
