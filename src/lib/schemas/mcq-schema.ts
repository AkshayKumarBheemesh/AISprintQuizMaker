import { z } from "zod";

const choiceSchema = z.object({
	id: z
		.string()
		.trim()
		.optional()
		.transform((value) => (value ? value : undefined)),
	choiceText: z
		.string()
		.trim()
		.min(1, "Choice text is required.")
		.max(500, "Choice text must be at most 500 characters."),
	isCorrect: z.boolean(),
});

export const mcqWriteSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(1, "Name is required.")
			.max(200, "Name must be at most 200 characters."),
		question: z
			.string()
			.trim()
			.min(1, "Question is required.")
			.max(2000, "Question must be at most 2000 characters."),
		choices: z
			.array(choiceSchema)
			.min(2, "Add at least two choices.")
			.max(6, "You can add at most six choices."),
	})
	.refine((data) => data.choices.filter((choice) => choice.isCorrect).length === 1, {
		message: "Select exactly one correct choice.",
		path: ["choices"],
	});

export type McqWriteFields = z.input<typeof mcqWriteSchema>;
export type McqChoiceFields = z.input<typeof choiceSchema>;
