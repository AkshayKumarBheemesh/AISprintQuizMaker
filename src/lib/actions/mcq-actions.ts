"use server";

import { redirect } from "next/navigation";

import { SESSION_CLEAR_PATH } from "@/lib/auth-constants";
import { MCQ_INVALID_CHOICE_MESSAGE, MCQ_NOT_FOUND_MESSAGE } from "@/lib/mcq/errors";
import { mcqWriteSchema } from "@/lib/schemas/mcq-schema";
import { getCurrentUser } from "@/lib/session";
import { createMcq, deleteMcq, recordAttempt, updateMcq } from "@/lib/services/mcq-service";

export type McqFieldErrors = {
	name?: string[];
	question?: string[];
	choices?: string[];
	id?: string[];
	form?: string[];
};

export type McqFormState = {
	errors?: McqFieldErrors;
	values?: {
		id?: string;
		name?: string;
		question?: string;
	};
};

export type RecordAttemptState =
	| { ok: true; isCorrect: boolean }
	| { ok: false; error: string };

type Issue = {
	path: PropertyKey[];
	message: string;
};

export async function createMcqAction(
	_prevState: McqFormState,
	formData: FormData,
): Promise<McqFormState> {
	const user = await requireUser();
	const raw = readMcqFields(formData);
	const parsed = mcqWriteSchema.safeParse(raw);
	if (!parsed.success) {
		return { errors: toFieldErrors(parsed.error.issues), values: safeValues(raw) };
	}

	const result = await createMcq(user.id, parsed.data);
	if (!result.ok) {
		return { errors: { form: ["Select exactly one correct choice."] }, values: safeValues(raw) };
	}

	redirect("/dashboard");
}

export async function updateMcqAction(
	_prevState: McqFormState,
	formData: FormData,
): Promise<McqFormState> {
	const user = await requireUser();
	const id = readField(formData, "id").trim();
	const raw = readMcqFields(formData);
	const parsed = mcqWriteSchema.safeParse(raw);
	if (!parsed.success) {
		return {
			errors: toFieldErrors(parsed.error.issues),
			values: { ...safeValues(raw), id },
		};
	}

	if (!id) {
		return { errors: { form: [MCQ_NOT_FOUND_MESSAGE] }, values: safeValues(raw) };
	}

	const result = await updateMcq(id, user.id, parsed.data);
	if (!result.ok) {
		return {
			errors: {
				form: [result.error === "NOT_FOUND" ? MCQ_NOT_FOUND_MESSAGE : "Select exactly one correct choice."],
			},
			values: { ...safeValues(raw), id },
		};
	}

	redirect("/dashboard");
}

export async function deleteMcqAction(
	_prevState: McqFormState,
	formData: FormData,
): Promise<McqFormState> {
	const user = await requireUser();
	const id = readField(formData, "id").trim();
	if (!id) {
		return { errors: { form: [MCQ_NOT_FOUND_MESSAGE] } };
	}

	await deleteMcq(id, user.id);
	redirect("/dashboard");
}

export async function recordAttemptAction(
	_prevState: RecordAttemptState | McqFormState,
	formData: FormData,
): Promise<RecordAttemptState> {
	const user = await requireUser();
	const mcqId = readField(formData, "mcqId").trim();
	const choiceId = readField(formData, "choiceId").trim();

	if (!mcqId || !choiceId) {
		return { ok: false, error: MCQ_INVALID_CHOICE_MESSAGE };
	}

	const result = await recordAttempt(user.id, mcqId, choiceId);
	if (!result.ok) {
		return {
			ok: false,
			error:
				result.error === "NOT_FOUND" ? MCQ_NOT_FOUND_MESSAGE : MCQ_INVALID_CHOICE_MESSAGE,
		};
	}

	return { ok: true, isCorrect: result.isCorrect };
}

async function requireUser() {
	const user = await getCurrentUser();
	if (!user) {
		redirect(SESSION_CLEAR_PATH);
	}

	return user;
}

function readMcqFields(formData: FormData) {
	return {
		name: readField(formData, "name"),
		question: readField(formData, "question"),
		choices: readChoices(formData),
	};
}

function readChoices(formData: FormData) {
	const choices: { id?: string; choiceText: string; isCorrect: boolean }[] = [];

	for (let index = 0; index < 7; index += 1) {
		const choiceText = formData.get(`choices.${index}.choiceText`);
		if (typeof choiceText !== "string") {
			break;
		}

		const id = readField(formData, `choices.${index}.id`).trim();
		choices.push({
			...(id ? { id } : {}),
			choiceText,
			isCorrect: formData.get(`choices.${index}.isCorrect`) === "true",
		});
	}

	return choices;
}

function readField(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === "string" ? value : "";
}

function safeValues(raw: { name: string; question: string }) {
	return {
		name: raw.name.trim(),
		question: raw.question.trim(),
	};
}

function toFieldErrors(issues: Issue[]): McqFieldErrors {
	const grouped: Record<string, string[]> = {};

	for (const issue of issues) {
		const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
		grouped[key] = [...(grouped[key] ?? []), issue.message];
	}

	return grouped;
}
