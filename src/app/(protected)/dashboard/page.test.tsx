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

vi.mock("@/lib/actions/mcq-actions", () => ({
	deleteMcqAction: vi.fn(),
}));

vi.mock("@/lib/services/mcq-service", () => ({
	listMcqs: vi.fn(),
}));

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { listMcqs } from "@/lib/services/mcq-service";

import DashboardPage from "./page";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRedirect = vi.mocked(redirect);
const mockListMcqs = vi.mocked(listMcqs);

const AUTH_USER = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.org",
};

beforeEach(() => {
	vi.clearAllMocks();
	mockListMcqs.mockResolvedValue([]);
});

describe("dashboard page", () => {
	it("shows MCQ Home, the user's name, logout, and the MCQ list", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);
		mockListMcqs.mockResolvedValue([
			{
				id: "mcq-1",
				name: "Capitals",
				question: "What is the capital of France?",
				createdByUserId: AUTH_USER.id,
				createdAt: 1,
				updatedAt: 1,
			},
		]);

		render(await DashboardPage());

		expect(screen.getByRole("heading", { name: "MCQ Home" })).toBeInTheDocument();
		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
		expect(screen.getByText("Capitals")).toBeInTheDocument();
		expect(screen.getByText("What is the capital of France?")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /create/i })).toHaveAttribute(
			"href",
			"/dashboard/mcqs/new",
		);
		expect(screen.queryByText(/quiz features arrive in a later sprint/i)).not.toBeInTheDocument();
		expect(mockListMcqs).toHaveBeenCalledWith("user-1");
	});

	it("shows an empty list state when the teacher has no MCQs", async () => {
		mockGetCurrentUser.mockResolvedValue(AUTH_USER);

		render(await DashboardPage());

		expect(screen.getByText(/no questions yet/i)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /create/i })).toBeInTheDocument();
	});

	it("redirects to the cookie-clearing route when there is no authenticated user", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT:/api/auth/clear-session");
		expect(mockRedirect).toHaveBeenCalledWith("/api/auth/clear-session");
		expect(mockListMcqs).not.toHaveBeenCalled();
	});
});
