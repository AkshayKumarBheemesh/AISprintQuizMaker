/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/mcq-actions", () => ({
	recordAttemptAction: vi.fn(),
}));

import { recordAttemptAction } from "@/lib/actions/mcq-actions";

import { McqPreview } from "./mcq-preview";

const mockRecord = vi.mocked(recordAttemptAction);

const MCQ = {
	id: "mcq-1",
	name: "Capitals",
	question: "What is the capital of France?",
	choices: [
		{ id: "choice-1", choiceText: "Paris", isCorrect: true },
		{ id: "choice-2", choiceText: "Lyon", isCorrect: false },
	],
};

beforeEach(() => {
	vi.clearAllMocks();
	mockRecord.mockResolvedValue({ ok: true, isCorrect: true });
});

describe("McqPreview", () => {
	it("renders the name, question, and choices without edit controls", () => {
		render(<McqPreview mcq={MCQ} />);

		expect(screen.getByRole("heading", { name: "Capitals" })).toBeInTheDocument();
		expect(screen.getByText("What is the capital of France?")).toBeInTheDocument();
		expect(screen.getByText("Paris")).toBeInTheDocument();
		expect(screen.getByText("Lyon")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
	});

	it("does not reveal the correct choice before an attempt is submitted", () => {
		render(<McqPreview mcq={MCQ} />);

		expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument();
	});

	it("submits the selected choice through recordAttemptAction and shows the server result", async () => {
		const user = userEvent.setup();
		mockRecord.mockResolvedValue({ ok: true, isCorrect: false });
		render(<McqPreview mcq={MCQ} />);

		await user.click(screen.getByRole("radio", { name: "Lyon" }));
		await user.click(screen.getByRole("button", { name: /submit/i }));

		await vi.waitFor(() => expect(mockRecord).toHaveBeenCalled());
		const data = mockRecord.mock.calls[0]?.[1] as FormData;
		expect(data.get("mcqId")).toBe("mcq-1");
		expect(data.get("choiceId")).toBe("choice-2");
		expect(data.get("isCorrect")).toBeNull();
		expect(await screen.findByText(/incorrect/i)).toBeInTheDocument();
	});
});
