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

vi.mock("@/lib/actions/mcq-actions", () => ({
	createMcqAction: vi.fn(),
	updateMcqAction: vi.fn(),
}));

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

import NewMcqPage from "./page";

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

describe("new MCQ page", () => {
	it("renders the create form for an authenticated user", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);

		render(await NewMcqPage());

		expect(screen.getByRole("heading", { name: /create/i })).toBeInTheDocument();
		expect(screen.getByLabelText("Name")).toBeInTheDocument();
		expect(screen.getByLabelText("Question")).toBeInTheDocument();
		expect(screen.getByLabelText("Choice 1")).toBeInTheDocument();
		expect(screen.getByLabelText("Choice 2")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute("href", "/dashboard");
	});

	it("redirects to the cookie-clearing route when there is no authenticated user", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(NewMcqPage()).rejects.toThrow("NEXT_REDIRECT:/api/auth/clear-session");
		expect(mockRedirect).toHaveBeenCalledWith("/api/auth/clear-session");
	});
});
