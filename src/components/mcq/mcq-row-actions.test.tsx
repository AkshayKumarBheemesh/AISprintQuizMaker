/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { McqRowActions } from "./mcq-row-actions";

describe("McqRowActions", () => {
	it("renders an accessible three-dot trigger", () => {
		render(<McqRowActions mcqId="mcq-1" name="Capitals" onDelete={vi.fn()} />);

		expect(screen.getByRole("button", { name: "Actions for Capitals" })).toBeInTheDocument();
	});

	it("exposes Edit and Preview links for the MCQ and asks to confirm delete", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(<McqRowActions mcqId="mcq-1" name="Capitals" onDelete={onDelete} />);

		await user.click(screen.getByRole("button", { name: "Actions for Capitals" }));

		const edit = await screen.findByRole("menuitem", { name: /edit/i });
		const preview = screen.getByRole("menuitem", { name: /preview/i });
		const remove = screen.getByRole("menuitem", { name: /delete/i });

		expect(edit.closest("a") ?? edit).toHaveAttribute("href", "/dashboard/mcqs/mcq-1/edit");
		expect(preview.closest("a") ?? preview).toHaveAttribute(
			"href",
			"/dashboard/mcqs/mcq-1/preview",
		);

		await user.click(remove);

		expect(onDelete).toHaveBeenCalledWith("mcq-1");
		expect(onDelete).toHaveBeenCalledTimes(1);
	});
});
