import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	redirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	}),
}));

vi.mock("@/lib/session", () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/services/mcq-service", () => ({
	createMcq: vi.fn(),
	updateMcq: vi.fn(),
	deleteMcq: vi.fn(),
	recordAttempt: vi.fn(),
}));

import { redirect } from "next/navigation";

import { MCQ_INVALID_CHOICE_MESSAGE, MCQ_NOT_FOUND_MESSAGE } from "@/lib/mcq/errors";
import { getCurrentUser } from "@/lib/session";
import { createMcq, deleteMcq, recordAttempt, updateMcq } from "@/lib/services/mcq-service";

import {
	createMcqAction,
	deleteMcqAction,
	recordAttemptAction,
	updateMcqAction,
} from "./mcq-actions";

const mockRedirect = vi.mocked(redirect);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCreateMcq = vi.mocked(createMcq);
const mockUpdateMcq = vi.mocked(updateMcq);
const mockDeleteMcq = vi.mocked(deleteMcq);
const mockRecordAttempt = vi.mocked(recordAttempt);

const AUTH_USER = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.org",
};

const CREATED_MCQ = {
	id: "mcq-1",
	name: "Capitals",
	question: "What is the capital of France?",
	createdByUserId: AUTH_USER.id,
	createdAt: 1_700_000_000,
	updatedAt: 1_700_000_000,
	choices: [
		{
			id: "choice-1",
			mcqId: "mcq-1",
			choiceText: "Paris",
			isCorrect: true,
			position: 0,
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_000,
		},
		{
			id: "choice-2",
			mcqId: "mcq-1",
			choiceText: "Lyon",
			isCorrect: false,
			position: 1,
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_000,
		},
	],
};

type ChoiceInput = {
	id?: string;
	choiceText: string;
	isCorrect: boolean;
};

function mcqForm(
	overrides: {
		id?: string;
		name?: string;
		question?: string;
		choices?: ChoiceInput[];
		createdByUserId?: string;
		userId?: string;
	} = {},
) {
	const fields = {
		name: "Capitals",
		question: "What is the capital of France?",
		choices: [
			{ choiceText: "Paris", isCorrect: true },
			{ choiceText: "Lyon", isCorrect: false },
		] satisfies ChoiceInput[],
		...overrides,
	};

	const formData = new FormData();
	formData.set("name", fields.name);
	formData.set("question", fields.question);
	if (fields.id) {
		formData.set("id", fields.id);
	}
	if (fields.createdByUserId) {
		formData.set("createdByUserId", fields.createdByUserId);
		formData.set("created_by_user_id", fields.createdByUserId);
	}
	if (fields.userId) {
		formData.set("userId", fields.userId);
	}

	fields.choices.forEach((choice, index) => {
		formData.set(`choices.${index}.choiceText`, choice.choiceText);
		formData.set(`choices.${index}.isCorrect`, choice.isCorrect ? "true" : "false");
		if (choice.id) {
			formData.set(`choices.${index}.id`, choice.id);
		}
	});

	return formData;
}

function attemptForm(
	overrides: {
		mcqId?: string;
		choiceId?: string;
		isCorrect?: string;
		userId?: string;
	} = {},
) {
	const formData = new FormData();
	formData.set("mcqId", overrides.mcqId ?? "mcq-1");
	formData.set("choiceId", overrides.choiceId ?? "choice-1");
	if (overrides.isCorrect !== undefined) {
		formData.set("isCorrect", overrides.isCorrect);
	}
	if (overrides.userId) {
		formData.set("userId", overrides.userId);
	}
	return formData;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockGetCurrentUser.mockResolvedValue(AUTH_USER);
	mockCreateMcq.mockResolvedValue({ ok: true, mcq: CREATED_MCQ });
	mockUpdateMcq.mockResolvedValue({ ok: true, mcq: CREATED_MCQ });
	mockDeleteMcq.mockResolvedValue({ ok: true });
	mockRecordAttempt.mockResolvedValue({
		ok: true,
		attemptId: "attempt-1",
		isCorrect: true,
	});
});

describe("createMcqAction", () => {
	it("redirects an unauthenticated user to the cookie-clearing route", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(createMcqAction({}, mcqForm())).rejects.toThrow(
			"NEXT_REDIRECT:/api/auth/clear-session",
		);
		expect(mockRedirect).toHaveBeenCalledWith("/api/auth/clear-session");
		expect(mockCreateMcq).not.toHaveBeenCalled();
	});

	it("creates an MCQ for the authenticated user and redirects to /dashboard", async () => {
		await expect(createMcqAction({}, mcqForm())).rejects.toThrow("NEXT_REDIRECT:/dashboard");

		expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
		expect(mockCreateMcq).toHaveBeenCalledTimes(1);
		expect(mockCreateMcq).toHaveBeenCalledWith(AUTH_USER.id, {
			name: "Capitals",
			question: "What is the capital of France?",
			choices: [
				{ choiceText: "Paris", isCorrect: true },
				{ choiceText: "Lyon", isCorrect: false },
			],
		});
	});

	it("takes the user id from getCurrentUser, not from the form", async () => {
		await expect(
			createMcqAction(
				{},
				mcqForm({ createdByUserId: "attacker", userId: "attacker" }),
			),
		).rejects.toThrow("NEXT_REDIRECT:/dashboard");

		expect(mockCreateMcq).toHaveBeenCalledWith(
			"user-1",
			expect.not.objectContaining({
				createdByUserId: "attacker",
				created_by_user_id: "attacker",
				userId: "attacker",
			}),
		);
		expect(mockCreateMcq.mock.calls[0]?.[0]).toBe("user-1");
		expect(JSON.stringify(mockCreateMcq.mock.calls[0]?.[1])).not.toContain("attacker");
	});

	it("returns Zod errors and does not call the service when name is missing", async () => {
		const state = await createMcqAction({}, mcqForm({ name: "" }));

		expect(state.errors?.name).toContain("Name is required.");
		expect(mockCreateMcq).not.toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("returns Zod errors and does not call the service when only one choice is sent", async () => {
		const state = await createMcqAction(
			{},
			mcqForm({
				choices: [{ choiceText: "Paris", isCorrect: true }],
			}),
		);

		expect(state.errors?.choices).toContain("Add at least two choices.");
		expect(mockCreateMcq).not.toHaveBeenCalled();
	});
});

describe("updateMcqAction", () => {
	it("redirects an unauthenticated user to the cookie-clearing route", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(updateMcqAction({}, mcqForm({ id: "mcq-1" }))).rejects.toThrow(
			"NEXT_REDIRECT:/api/auth/clear-session",
		);
		expect(mockUpdateMcq).not.toHaveBeenCalled();
	});

	it("updates the named MCQ for the authenticated user and redirects to /dashboard", async () => {
		await expect(
			updateMcqAction(
				{},
				mcqForm({
					id: "mcq-1",
					choices: [
						{ id: "choice-1", choiceText: "Paris", isCorrect: true },
						{ id: "choice-2", choiceText: "Marseille", isCorrect: false },
					],
				}),
			),
		).rejects.toThrow("NEXT_REDIRECT:/dashboard");

		expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
		expect(mockUpdateMcq).toHaveBeenCalledWith("mcq-1", AUTH_USER.id, {
			name: "Capitals",
			question: "What is the capital of France?",
			choices: [
				{ id: "choice-1", choiceText: "Paris", isCorrect: true },
				{ id: "choice-2", choiceText: "Marseille", isCorrect: false },
			],
		});
	});

	it("does not take ownership from the client", async () => {
		await expect(
			updateMcqAction(
				{},
				mcqForm({ id: "mcq-1", createdByUserId: "attacker", userId: "attacker" }),
			),
		).rejects.toThrow("NEXT_REDIRECT:/dashboard");

		expect(mockUpdateMcq.mock.calls[0]?.[1]).toBe("user-1");
		expect(JSON.stringify(mockUpdateMcq.mock.calls[0]?.[2])).not.toContain("attacker");
	});

	it("returns Zod errors and does not call the service when the question is missing", async () => {
		const state = await updateMcqAction({}, mcqForm({ id: "mcq-1", question: "" }));

		expect(state.errors?.question).toContain("Question is required.");
		expect(mockUpdateMcq).not.toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("returns a safe not-found error when the service cannot see the MCQ", async () => {
		mockUpdateMcq.mockResolvedValue({ ok: false, error: "NOT_FOUND" });

		const state = await updateMcqAction({}, mcqForm({ id: "mcq-1" }));

		expect(state.errors?.form).toEqual([MCQ_NOT_FOUND_MESSAGE]);
		expect(mockRedirect).not.toHaveBeenCalled();
	});
});

describe("deleteMcqAction", () => {
	it("redirects an unauthenticated user to the cookie-clearing route", async () => {
		mockGetCurrentUser.mockResolvedValue(null);
		const formData = new FormData();
		formData.set("id", "mcq-1");

		await expect(deleteMcqAction({}, formData)).rejects.toThrow(
			"NEXT_REDIRECT:/api/auth/clear-session",
		);
		expect(mockDeleteMcq).not.toHaveBeenCalled();
	});

	it("deletes the named MCQ as the authenticated user and redirects to /dashboard", async () => {
		const formData = new FormData();
		formData.set("id", "mcq-1");
		formData.set("userId", "attacker");

		await expect(deleteMcqAction({}, formData)).rejects.toThrow("NEXT_REDIRECT:/dashboard");

		expect(mockDeleteMcq).toHaveBeenCalledWith("mcq-1", AUTH_USER.id);
		expect(mockDeleteMcq).toHaveBeenCalledTimes(1);
		expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
	});
});

describe("recordAttemptAction", () => {
	it("redirects an unauthenticated user to the cookie-clearing route", async () => {
		mockGetCurrentUser.mockResolvedValue(null);

		await expect(recordAttemptAction({}, attemptForm())).rejects.toThrow(
			"NEXT_REDIRECT:/api/auth/clear-session",
		);
		expect(mockRecordAttempt).not.toHaveBeenCalled();
	});

	it("records an attempt with session user, mcq id, and choice id", async () => {
		const state = await recordAttemptAction(
			{},
			attemptForm({ mcqId: "mcq-1", choiceId: "choice-2", userId: "attacker" }),
		);

		expect(mockRecordAttempt).toHaveBeenCalledWith("user-1", "mcq-1", "choice-2");
		expect(mockRecordAttempt.mock.calls[0]).toHaveLength(3);
		expect(state).toEqual({ ok: true, isCorrect: true });
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("returns the service-computed correctness and ignores a client isCorrect flag", async () => {
		mockRecordAttempt.mockResolvedValue({
			ok: true,
			attemptId: "attempt-2",
			isCorrect: false,
		});

		const state = await recordAttemptAction(
			{},
			attemptForm({ isCorrect: "true", choiceId: "choice-2" }),
		);

		expect(mockRecordAttempt).toHaveBeenCalledWith("user-1", "mcq-1", "choice-2");
		expect(JSON.stringify(mockRecordAttempt.mock.calls[0])).not.toContain("true");
		expect(state).toEqual({ ok: true, isCorrect: false });
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("returns a safe error when the choice does not belong to the MCQ", async () => {
		mockRecordAttempt.mockResolvedValue({ ok: false, error: "INVALID_CHOICE" });

		const state = await recordAttemptAction({}, attemptForm());

		expect(state).toEqual({ ok: false, error: MCQ_INVALID_CHOICE_MESSAGE });
		expect(mockRedirect).not.toHaveBeenCalled();
	});
});
