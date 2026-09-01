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

import AuthLayout from "./layout";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRedirect = vi.mocked(redirect);

const AUTH_USER = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.org",
};

const children = <div>auth form</div>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("auth layout", () => {
	it("redirects an authenticated user to /dashboard", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);

		await expect(AuthLayout({ children })).rejects.toThrow("NEXT_REDIRECT:/dashboard");
		expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
	});

	it("renders the auth pages for an unauthenticated visitor", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		const result = await AuthLayout({ children });

		expect(isValidElement(result)).toBe(true);
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("renders the auth pages when the session is invalid or expired", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		const result = await AuthLayout({ children });

		expect(isValidElement(result)).toBe(true);
	});

	it("decides using getCurrentUser rather than cookie presence", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await AuthLayout({ children });

		expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
	});
});
