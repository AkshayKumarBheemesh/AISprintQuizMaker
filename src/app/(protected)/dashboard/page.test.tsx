/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	redirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	}),
}));

vi.mock("@/lib/session", () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/actions/auth-actions", () => ({
	logoutAction: vi.fn(),
}));

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

import DashboardPage from "./page";

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

describe("dashboard page", () => {
	it("C-10: shows MCQ Home, the user's name, a logout control, and a placeholder card", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);

		render(await DashboardPage());

		expect(screen.getByRole("heading", { name: "MCQ Home" })).toBeInTheDocument();
		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
		expect(screen.getByText(/quiz features arrive in a later sprint/i)).toBeInTheDocument();
	});

	it("contains no quiz authoring controls or links", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);

		render(await DashboardPage());

		expect(screen.queryByRole("link", { name: /quiz|mcq|create question/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /create|author|generate/i })).not.toBeInTheDocument();
	});

	it("redirects to the cookie-clearing route when there is no authenticated user", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT:/api/auth/clear-session");
		expect(mockRedirect).toHaveBeenCalledWith("/api/auth/clear-session");
	});
});
