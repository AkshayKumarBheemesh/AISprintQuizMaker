/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/mcq-actions", () => ({
	deleteMcqAction: vi.fn(),
}));

import { deleteMcqAction } from "@/lib/actions/mcq-actions";

import { DeleteMcqDialog } from "./delete-mcq-dialog";

const mockDelete = vi.mocked(deleteMcqAction);

beforeEach(() => {
	vi.clearAllMocks();
	mockDelete.mockResolvedValue({});
});

describe("DeleteMcqDialog", () => {
	it("does not show confirmation copy when closed", () => {
		render(
			<DeleteMcqDialog mcqId="mcq-1" open={false} onOpenChange={vi.fn()} />,
		);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(screen.queryByText(/permanently deleted/i)).not.toBeInTheDocument();
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("shows confirmation when opened and Cancel closes without deleting", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(<DeleteMcqDialog mcqId="mcq-1" open onOpenChange={onOpenChange} />);

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /cancel/i }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("submits the MCQ id to deleteMcqAction on confirm", async () => {
		const user = userEvent.setup();
		render(<DeleteMcqDialog mcqId="mcq-1" open onOpenChange={vi.fn()} />);

		await user.click(screen.getByRole("button", { name: /delete/i }));

		await vi.waitFor(() => expect(mockDelete).toHaveBeenCalled());
		const data = mockDelete.mock.calls[0]?.[1] as FormData;
		expect(data.get("id")).toBe("mcq-1");
	});
});
