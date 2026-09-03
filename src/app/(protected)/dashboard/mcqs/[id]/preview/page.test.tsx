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
	recordAttemptAction: vi.fn(),
}));

vi.mock("@/lib/services/mcq-service", () => ({
	getMcq: vi.fn(),
}));

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getMcq } from "@/lib/services/mcq-service";

import PreviewMcqPage from "./page";

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

describe("preview MCQ page", () => {
	it("renders a read-only preview without revealing the correct choice", async () => {
		render(await PreviewMcqPage({ params: Promise.resolve({ id: "mcq-1" }) }));

		expect(mockGetMcq).toHaveBeenCalledWith("mcq-1", "user-1");
		expect(screen.getByRole("heading", { name: "Capitals" })).toBeInTheDocument();
		expect(screen.getByText("What is the capital of France?")).toBeInTheDocument();
		expect(screen.getByText("Paris")).toBeInTheDocument();
		expect(screen.getByText("Lyon")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
		expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
	});

	it("redirects to the list when the MCQ is missing or not owned", async () => {
		mockGetMcq.mockResolvedValue(null);

		await expect(PreviewMcqPage({ params: Promise.resolve({ id: "mcq-1" }) })).rejects.toThrow(
			"NEXT_REDIRECT:/dashboard",
		);
	});

	it("redirects to the cookie-clearing route when there is no authenticated user", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(PreviewMcqPage({ params: Promise.resolve({ id: "mcq-1" }) })).rejects.toThrow(
			"NEXT_REDIRECT:/api/auth/clear-session",
		);
		expect(mockGetMcq).not.toHaveBeenCalled();
		expect(mockRedirect).toHaveBeenCalledWith("/api/auth/clear-session");
	});
});
