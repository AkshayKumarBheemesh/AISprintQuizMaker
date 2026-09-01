import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	redirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	}),
}));

vi.mock("@/lib/session", () => ({
	getCurrentUser: vi.fn(),
}));

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

import Home from "./page";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRedirect = vi.mocked(redirect);

const AUTH_USER = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.org",
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("root route", () => {
	it("sends an authenticated user to /dashboard", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);

		await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
		expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
	});

	it("sends an unauthenticated visitor to /login", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/login");
		expect(mockRedirect).toHaveBeenCalledWith("/login");
	});

	it("sends a user with an invalid or expired session to /login", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/login");
	});

	it("renders no content of its own in either case", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);

		await expect(Home()).rejects.toThrow("NEXT_REDIRECT");
		expect(mockRedirect).toHaveBeenCalledTimes(1);
	});
});
