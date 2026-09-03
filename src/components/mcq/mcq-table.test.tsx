/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { McqTable } from "./mcq-table";

const ITEMS = [
	{
		id: "mcq-1",
		name: "Capitals",
		question: "What is the capital of France?",
	},
	{
		id: "mcq-2",
		name: "Rivers",
		question: "Which river runs through London?",
	},
];

describe("McqTable", () => {
	it("renders each MCQ name, question, and an actions column", () => {
		render(<McqTable items={ITEMS} />);

		expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
		expect(screen.getByRole("columnheader", { name: "Question" })).toBeInTheDocument();
		expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
		expect(screen.getByText("Capitals")).toBeInTheDocument();
		expect(screen.getByText("What is the capital of France?")).toBeInTheDocument();
		expect(screen.getByText("Rivers")).toBeInTheDocument();
		expect(screen.getByText("Which river runs through London?")).toBeInTheDocument();
		expect(screen.getAllByRole("row")).toHaveLength(3);
	});

	it("renders a Create control that points at the new-MCQ route", () => {
		render(<McqTable items={ITEMS} />);

		expect(screen.getByRole("link", { name: /create/i })).toHaveAttribute(
			"href",
			"/dashboard/mcqs/new",
		);
	});

	it("shows an empty state and still offers Create when there are no MCQs", () => {
		render(<McqTable items={[]} />);

		expect(screen.getByText(/no questions yet/i)).toBeInTheDocument();
		expect(screen.queryByRole("row")).not.toBeInTheDocument();
		expect(screen.getByRole("link", { name: /create/i })).toHaveAttribute(
			"href",
			"/dashboard/mcqs/new",
		);
	});

	it("renders a row-actions trigger for each MCQ", () => {
		render(<McqTable items={ITEMS} />);

		expect(screen.getByRole("button", { name: "Actions for Capitals" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Actions for Rivers" })).toBeInTheDocument();
	});
});
