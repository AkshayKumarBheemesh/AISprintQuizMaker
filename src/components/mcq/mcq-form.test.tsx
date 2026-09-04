/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/mcq-actions", () => ({
	createMcqAction: vi.fn(),
	updateMcqAction: vi.fn(),
}));

import { createMcqAction, updateMcqAction } from "@/lib/actions/mcq-actions";

import { McqForm } from "./mcq-form";

const mockCreate = vi.mocked(createMcqAction);
const mockUpdate = vi.mocked(updateMcqAction);

beforeEach(() => {
	vi.clearAllMocks();
	mockCreate.mockResolvedValue({});
	mockUpdate.mockResolvedValue({});
});

describe("McqForm", () => {
	it("renders name, question, Save, and a Cancel link back to the list", () => {
		render(<McqForm mode="create" />);

		expect(screen.getByLabelText("Name")).toBeInTheDocument();
		expect(screen.getByLabelText("Question")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute("href", "/dashboard");
	});

	it("starts a new MCQ with exactly two choices", () => {
		render(<McqForm mode="create" />);

		expect(screen.getByLabelText("Choice 1")).toBeInTheDocument();
		expect(screen.getByLabelText("Choice 2")).toBeInTheDocument();
		expect(screen.queryByLabelText("Choice 3")).not.toBeInTheDocument();
	});

	it("adds choices up to six and then disables further adds", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		const add = screen.getByRole("button", { name: /add choice/i });
		await user.click(add);
		await user.click(add);
		await user.click(add);
		await user.click(add);

		expect(screen.getByLabelText("Choice 6")).toBeInTheDocument();
		expect(screen.queryByLabelText("Choice 7")).not.toBeInTheDocument();
		expect(add).toBeDisabled();
	});

	it("does not remove a choice when only two remain", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		expect(screen.getAllByRole("button", { name: /remove choice/i })[0]).toBeDisabled();

		await user.click(screen.getByRole("button", { name: /add choice/i }));
		await user.click(screen.getByRole("button", { name: /remove choice 3/i }));

		expect(screen.queryByLabelText("Choice 3")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Choice 1")).toBeInTheDocument();
		expect(screen.getByLabelText("Choice 2")).toBeInTheDocument();
	});

	it("lets only one choice be marked correct", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		const first = screen.getByRole("radio", { name: /choice 1 is correct/i });
		const second = screen.getByRole("radio", { name: /choice 2 is correct/i });

		await user.click(first);
		expect(first).toBeChecked();
		expect(second).not.toBeChecked();

		await user.click(second);
		expect(second).toBeChecked();
		expect(first).not.toBeChecked();
	});

	it("loads existing values and preserves choice IDs in edit mode", async () => {
		const user = userEvent.setup();
		render(
			<McqForm
				mode="edit"
				mcqId="mcq-1"
				defaultValues={{
					name: "Capitals",
					question: "What is the capital of France?",
					choices: [
						{ id: "choice-1", choiceText: "Paris", isCorrect: true },
						{ id: "choice-2", choiceText: "Lyon", isCorrect: false },
					],
				}}
			/>,
		);

		expect(screen.getByLabelText("Name")).toHaveValue("Capitals");
		expect(screen.getByLabelText("Question")).toHaveValue("What is the capital of France?");
		expect(screen.getByLabelText("Choice 1")).toHaveValue("Paris");
		expect(screen.getByDisplayValue("choice-1")).toBeInTheDocument();
		expect(screen.getByDisplayValue("choice-2")).toBeInTheDocument();
		expect(screen.getByDisplayValue("mcq-1")).toBeInTheDocument();

		await user.clear(screen.getByLabelText("Choice 2"));
		await user.type(screen.getByLabelText("Choice 2"), "Marseille");
		await user.click(screen.getByRole("button", { name: /save/i }));

		await vi.waitFor(() => expect(mockUpdate).toHaveBeenCalled());
		const data = mockUpdate.mock.calls[0]?.[1] as FormData;
		expect(data.get("id")).toBe("mcq-1");
		expect(data.get("choices.0.id")).toBe("choice-1");
		expect(data.get("choices.1.id")).toBe("choice-2");
		expect(data.get("choices.1.choiceText")).toBe("Marseille");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("submits a new MCQ without requiring choice ids", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText("Name"), "Capitals");
		await user.type(screen.getByLabelText("Question"), "What is the capital of France?");
		await user.type(screen.getByLabelText("Choice 1"), "Paris");
		await user.type(screen.getByLabelText("Choice 2"), "Lyon");
		await user.click(screen.getByRole("radio", { name: /choice 1 is correct/i }));
		await user.click(screen.getByRole("button", { name: /save/i }));

		await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
		const data = mockCreate.mock.calls[0]?.[1] as FormData;
		expect(data.get("name")).toBe("Capitals");
		expect(data.get("choices.0.choiceText")).toBe("Paris");
		expect(data.get("choices.0.isCorrect")).toBe("true");
		expect(data.get("choices.0.id")).toBeNull();
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it("does not submit when Cancel is used", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("link", { name: /cancel/i }));

		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockUpdate).not.toHaveBeenCalled();
	});
});
