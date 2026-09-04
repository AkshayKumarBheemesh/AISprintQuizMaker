import { describe, expect, it } from "vitest";

import { mcqWriteSchema } from "./mcq-schema";

function choice(
	overrides: {
		id?: string;
		choiceText?: string;
		isCorrect?: boolean;
	} = {},
) {
	return {
		choiceText: "Paris",
		isCorrect: false,
		...overrides,
	};
}

function validInput(
	overrides: {
		name?: string;
		question?: string;
		choices?: ReturnType<typeof choice>[];
	} = {},
) {
	return {
		name: "Capitals",
		question: "What is the capital of France?",
		choices: [
			choice({ choiceText: "Paris", isCorrect: true }),
			choice({ choiceText: "Lyon", isCorrect: false }),
		],
		...overrides,
	};
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[], field: string) {
	return issues.filter((issue) => issue.path[0] === field).map((issue) => issue.message);
}

describe("mcqWriteSchema", () => {
	it("accepts a valid MCQ with two choices and exactly one correct", () => {
		const result = mcqWriteSchema.safeParse(validInput());

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.choices).toHaveLength(2);
		expect(result.data.choices.filter((item) => item.isCorrect)).toHaveLength(1);
	});

	it("accepts six choices with exactly one correct", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [
					choice({ choiceText: "A", isCorrect: true }),
					choice({ choiceText: "B" }),
					choice({ choiceText: "C" }),
					choice({ choiceText: "D" }),
					choice({ choiceText: "E" }),
					choice({ choiceText: "F" }),
				],
			}),
		);

		expect(result.success).toBe(true);
	});

	it("trims name, question, and choice text", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				name: "  Capitals  ",
				question: "  What is the capital of France?  ",
				choices: [
					choice({ choiceText: "  Paris  ", isCorrect: true }),
					choice({ choiceText: "  Lyon  " }),
				],
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.name).toBe("Capitals");
		expect(result.data.question).toBe("What is the capital of France?");
		expect(result.data.choices[0]?.choiceText).toBe("Paris");
		expect(result.data.choices[1]?.choiceText).toBe("Lyon");
	});

	it.each([
		["empty", ""],
		["whitespace only", "   "],
	])("rejects a missing name (%s)", (_label, name) => {
		const result = mcqWriteSchema.safeParse(validInput({ name }));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "name")).toContain("Name is required.");
	});

	it.each([
		["empty", ""],
		["whitespace only", "   "],
	])("rejects a missing question (%s)", (_label, question) => {
		const result = mcqWriteSchema.safeParse(validInput({ question }));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "question")).toContain("Question is required.");
	});

	it("rejects a name longer than 200 characters after trim", () => {
		const result = mcqWriteSchema.safeParse(validInput({ name: `${"a".repeat(201)}` }));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "name").length).toBeGreaterThan(0);
	});

	it("accepts a name of exactly 200 characters", () => {
		const result = mcqWriteSchema.safeParse(validInput({ name: "a".repeat(200) }));

		expect(result.success).toBe(true);
	});

	it("rejects a question longer than 2000 characters after trim", () => {
		const result = mcqWriteSchema.safeParse(validInput({ question: "a".repeat(2001) }));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "question").length).toBeGreaterThan(0);
	});

	it("accepts a question of exactly 2000 characters", () => {
		const result = mcqWriteSchema.safeParse(validInput({ question: "a".repeat(2000) }));

		expect(result.success).toBe(true);
	});

	it("rejects choice text longer than 500 characters after trim", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [
					choice({ choiceText: "a".repeat(501), isCorrect: true }),
					choice({ choiceText: "Lyon" }),
				],
			}),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(
			result.error.issues.some(
				(issue) => issue.path[0] === "choices" && issue.path[1] === 0,
			),
		).toBe(true);
	});

	it("accepts choice text of exactly 500 characters", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [
					choice({ choiceText: "a".repeat(500), isCorrect: true }),
					choice({ choiceText: "Lyon" }),
				],
			}),
		);

		expect(result.success).toBe(true);
	});

	it("rejects fewer than two choices", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [choice({ choiceText: "Paris", isCorrect: true })],
			}),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "choices")).toContain("Add at least two choices.");
	});

	it("rejects more than six choices", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [
					choice({ choiceText: "A", isCorrect: true }),
					choice({ choiceText: "B" }),
					choice({ choiceText: "C" }),
					choice({ choiceText: "D" }),
					choice({ choiceText: "E" }),
					choice({ choiceText: "F" }),
					choice({ choiceText: "G" }),
				],
			}),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "choices")).toContain(
			"You can add at most six choices.",
		);
	});

	it.each([
		["empty", ""],
		["whitespace only", "   "],
	])("rejects empty choice text (%s)", (_label, choiceText) => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [choice({ choiceText, isCorrect: true }), choice({ choiceText: "Lyon" })],
			}),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(
			result.error.issues.some((issue) => issue.message === "Choice text is required."),
		).toBe(true);
	});

	it("rejects zero correct choices", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [choice({ choiceText: "Paris" }), choice({ choiceText: "Lyon" })],
			}),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "choices")).toContain(
			"Select exactly one correct choice.",
		);
	});

	it("rejects more than one correct choice", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [
					choice({ choiceText: "Paris", isCorrect: true }),
					choice({ choiceText: "Lyon", isCorrect: true }),
				],
			}),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "choices")).toContain(
			"Select exactly one correct choice.",
		);
	});

	it("keeps an existing choice id so updates can preserve it", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [
					choice({ id: "choice-1", choiceText: "Paris", isCorrect: true }),
					choice({ id: "choice-2", choiceText: "Lyon" }),
				],
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.choices[0]?.id).toBe("choice-1");
		expect(result.data.choices[1]?.id).toBe("choice-2");
	});

	it("does not require a choice id on create", () => {
		const result = mcqWriteSchema.safeParse(validInput());

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.choices[0]?.id).toBeUndefined();
	});

	it("treats a blank choice id as omitted so the create form can submit", () => {
		const result = mcqWriteSchema.safeParse(
			validInput({
				choices: [
					choice({ id: "", choiceText: "Paris", isCorrect: true }),
					choice({ id: "   ", choiceText: "Lyon" }),
				],
			}),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.choices[0]?.id).toBeUndefined();
		expect(result.data.choices[1]?.id).toBeUndefined();
	});
});
