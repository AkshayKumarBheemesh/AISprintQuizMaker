import { isValidElement } from "react";
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

import ProtectedLayout from "./layout";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRedirect = vi.mocked(redirect);

const AUTH_USER = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.org",
};

const children = <div>protected content</div>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("protected layout", () => {
	it("redirects to the cookie-clearing route when there is no session", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(ProtectedLayout({ children })).rejects.toThrow(
			"NEXT_REDIRECT:/api/auth/clear-session",
		);
		expect(mockRedirect).toHaveBeenCalledWith("/api/auth/clear-session");
	});

	it("treats an invalid session as logged out", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(ProtectedLayout({ children })).rejects.toThrow(
			"NEXT_REDIRECT:/api/auth/clear-session",
		);
	});

	it("treats an expired session as logged out", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(ProtectedLayout({ children })).rejects.toThrow(
			"NEXT_REDIRECT:/api/auth/clear-session",
		);
	});

	it("renders children for an authenticated user", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);

		const result = await ProtectedLayout({ children });

		expect(isValidElement(result)).toBe(true);
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("authorizes through getCurrentUser rather than trusting cookie presence", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);

		await ProtectedLayout({ children });

		expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
	});

	it("never renders children when the session is rejected", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(ProtectedLayout({ children })).rejects.toThrow("NEXT_REDIRECT");
		expect(mockRedirect).toHaveBeenCalledTimes(1);
	});
});
