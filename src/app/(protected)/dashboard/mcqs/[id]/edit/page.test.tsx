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

vi.mock("@/lib/services/mcq-service", () => ({
	getMcq: vi.fn(),
}));

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getMcq } from "@/lib/services/mcq-service";

import EditMcqPage from "./page";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRedirect = vi.mocked(redirect);
const mockGetMcq = vi.mocked(getMcq);

const AUTH_USER = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.org",
};

const MCQ = {
	id: "mcq-1",
	name: "Capitals",
	question: "What is the capital of France?",
	createdByUserId: AUTH_USER.id,
	createdAt: 1,
	updatedAt: 1,
	choices: [
		{
			id: "choice-1",
			mcqId: "mcq-1",
			choiceText: "Paris",
			isCorrect: true,
			position: 0,
			createdAt: 1,
			updatedAt: 1,
		},
		{
			id: "choice-2",
			mcqId: "mcq-1",
			choiceText: "Lyon",
			isCorrect: false,
			position: 1,
			createdAt: 1,
			updatedAt: 1,
		},
	],
};

beforeEach(() => {
	vi.clearAllMocks();
	mockGetCurrentUser.mockResolvedValue(AUTH_USER);
	mockGetMcq.mockResolvedValue(MCQ);
});

describe("edit MCQ page", () => {
	it("loads the owned MCQ into the edit form and keeps choice IDs", async () => {
		render(await EditMcqPage({ params: Promise.resolve({ id: "mcq-1" }) }));

		expect(mockGetMcq).toHaveBeenCalledWith("mcq-1", "user-1");
		expect(screen.getByRole("heading", { name: /edit/i })).toBeInTheDocument();
		expect(screen.getByLabelText("Name")).toHaveValue("Capitals");
		expect(screen.getByLabelText("Choice 1")).toHaveValue("Paris");
		expect(screen.getByDisplayValue("choice-1")).toBeInTheDocument();
		expect(screen.getByDisplayValue("choice-2")).toBeInTheDocument();
		expect(screen.getByDisplayValue("mcq-1")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
	});

	it("redirects to the list when the MCQ is missing or not owned", async () => {
		mockGetMcq.mockResolvedValue(null);

		await expect(EditMcqPage({ params: Promise.resolve({ id: "mcq-1" }) })).rejects.toThrow(
			"NEXT_REDIRECT:/dashboard",
		);
		expect(mockGetMcq).toHaveBeenCalledWith("mcq-1", "user-1");
	});

	it("redirects to the cookie-clearing route when there is no authenticated user", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(EditMcqPage({ params: Promise.resolve({ id: "mcq-1" }) })).rejects.toThrow(
			"NEXT_REDIRECT:/api/auth/clear-session",
		);
		expect(mockGetMcq).not.toHaveBeenCalled();
		expect(mockRedirect).toHaveBeenCalledWith("/api/auth/clear-session");
	});
});
