import { nowSeconds } from "@/lib/auth/time";
import { batch, execute, queryAll, queryOne, type BatchStatement } from "@/lib/d1-client";
import { mcqWriteSchema, type McqWriteFields } from "@/lib/schemas/mcq-schema";

export type McqWriteInput = McqWriteFields;

export type Mcq = {
	id: string;
	name: string;
	question: string;
	createdByUserId: string;
	createdAt: number;
	updatedAt: number;
};

export type McqChoice = {
	id: string;
	mcqId: string;
	choiceText: string;
	isCorrect: boolean;
	position: number;
	createdAt: number;
	updatedAt: number;
};

export type McqWithChoices = Mcq & {
	choices: McqChoice[];
};

export type CreateMcqResult =
	| { ok: true; mcq: McqWithChoices }
	| { ok: false; error: "INVALID_CHOICES" };

export type UpdateMcqResult =
	| { ok: true; mcq: McqWithChoices }
	| { ok: false; error: "NOT_FOUND" | "INVALID_CHOICES" };

export type DeleteMcqResult = { ok: true } | { ok: false; error: "NOT_FOUND" };

export type RecordAttemptResult =
	| { ok: true; attemptId: string; isCorrect: boolean }
	| { ok: false; error: "NOT_FOUND" | "INVALID_CHOICE" };

type McqRow = {
	id: string;
	name: string;
	question: string;
	created_by_user_id: string;
	created_at: number;
	updated_at: number;
};

type ChoiceRow = {
	id: string;
	mcq_id: string;
	choice_text: string;
	is_correct: number;
	position: number;
	created_at: number;
	updated_at: number;
};

export async function listMcqs(userId: string): Promise<Mcq[]> {
	const rows = await queryAll<McqRow>(
		"SELECT id, name, question, created_by_user_id, created_at, updated_at FROM mcqs WHERE created_by_user_id = ?1 ORDER BY created_at DESC",
		[userId],
	);

	return rows.map(toMcq);
}

export async function getMcq(id: string, userId: string): Promise<McqWithChoices | null> {
	const row = await queryOwnedMcq(id, userId);
	if (!row) {
		return null;
	}

	const choices = await listChoices(id);
	return { ...toMcq(row), choices };
}

export async function createMcq(userId: string, input: McqWriteInput): Promise<CreateMcqResult> {
	const parsed = mcqWriteSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "INVALID_CHOICES" };
	}

	const now = nowSeconds();
	const id = crypto.randomUUID();
	const choices = parsed.data.choices.map((choice, position) =>
		toWritableChoice(id, choice, position, now, now),
	);

	await execute(
		"INSERT INTO mcqs (id, name, question, created_by_user_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
		[id, parsed.data.name, parsed.data.question, userId, now, now],
	);

	for (const choice of choices) {
		await insertChoice(choice);
	}

	return {
		ok: true,
		mcq: {
			id,
			name: parsed.data.name,
			question: parsed.data.question,
			createdByUserId: userId,
			createdAt: now,
			updatedAt: now,
			choices,
		},
	};
}

export async function updateMcq(
	id: string,
	userId: string,
	input: McqWriteInput,
): Promise<UpdateMcqResult> {
	const existing = await queryOwnedMcq(id, userId);
	if (!existing) {
		return { ok: false, error: "NOT_FOUND" };
	}

	const parsed = mcqWriteSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "INVALID_CHOICES" };
	}

	const currentChoices = await queryAll<ChoiceRow>(
		"SELECT id, mcq_id, choice_text, is_correct, position, created_at, updated_at FROM mcq_choices WHERE mcq_id = ?1",
		[id],
	);
	const currentIds = new Set(currentChoices.map((choice) => choice.id));
	const now = nowSeconds();

	const statements: BatchStatement[] = [
		{
			sql: "UPDATE mcqs SET name = ?1, question = ?2, updated_at = ?3 WHERE id = ?4 AND created_by_user_id = ?5",
			params: [parsed.data.name, parsed.data.question, now, id, userId],
		},
		{
			sql: "UPDATE mcq_choices SET is_correct = 0 WHERE mcq_id = ?1",
			params: [id],
		},
	];

	const keptIds = new Set<string>();
	const choices: McqChoice[] = [];

	for (const [position, choice] of parsed.data.choices.entries()) {
		if (choice.id && currentIds.has(choice.id)) {
			keptIds.add(choice.id);
			const previous = currentChoices.find((row) => row.id === choice.id);
			statements.push({
				sql: "UPDATE mcq_choices SET choice_text = ?1, is_correct = ?2, position = ?3, updated_at = ?4 WHERE id = ?5 AND mcq_id = ?6",
				params: [choice.choiceText, choice.isCorrect ? 1 : 0, position, now, choice.id, id],
			});
			choices.push(
				toWritableChoice(id, choice, position, previous?.created_at ?? now, now, choice.id),
			);
			continue;
		}

		const created = toWritableChoice(id, choice, position, now, now);
		statements.push({
			sql: "INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
			params: [
				created.id,
				created.mcqId,
				created.choiceText,
				created.isCorrect ? 1 : 0,
				created.position,
				created.createdAt,
				created.updatedAt,
			],
		});
		choices.push(created);
	}

	for (const current of currentChoices) {
		if (keptIds.has(current.id)) {
			continue;
		}

		statements.push({
			sql: "DELETE FROM mcq_attempts WHERE choice_id = ?1",
			params: [current.id],
		});
		statements.push({
			sql: "DELETE FROM mcq_choices WHERE id = ?1 AND mcq_id = ?2",
			params: [current.id, id],
		});
	}

	await batch(statements);

	return {
		ok: true,
		mcq: {
			id,
			name: parsed.data.name,
			question: parsed.data.question,
			createdByUserId: userId,
			createdAt: existing.created_at,
			updatedAt: now,
			choices,
		},
	};
}

export async function deleteMcq(id: string, userId: string): Promise<DeleteMcqResult> {
	const existing = await queryOwnedMcq(id, userId);
	if (!existing) {
		return { ok: false, error: "NOT_FOUND" };
	}

	await execute("DELETE FROM mcq_attempts WHERE mcq_id = ?1", [id]);
	await execute("DELETE FROM mcq_choices WHERE mcq_id = ?1", [id]);
	await execute("DELETE FROM mcqs WHERE id = ?1 AND created_by_user_id = ?2", [id, userId]);

	return { ok: true };
}

export async function recordAttempt(
	userId: string,
	mcqId: string,
	choiceId: string,
): Promise<RecordAttemptResult> {
	const mcq = await queryOwnedMcq(mcqId, userId);
	if (!mcq) {
		return { ok: false, error: "NOT_FOUND" };
	}

	const choice = await queryOne<ChoiceRow>(
		"SELECT id, mcq_id, choice_text, is_correct, position, created_at, updated_at FROM mcq_choices WHERE id = ?1 AND mcq_id = ?2",
		[choiceId, mcqId],
	);
	if (!choice) {
		return { ok: false, error: "INVALID_CHOICE" };
	}

	const attemptId = crypto.randomUUID();
	const storedCorrect = choice.is_correct === 1 ? 1 : 0;

	await execute(
		"INSERT INTO mcq_attempts (id, mcq_id, choice_id, user_id, is_correct, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
		[attemptId, mcqId, choiceId, userId, storedCorrect, nowSeconds()],
	);

	return { ok: true, attemptId, isCorrect: storedCorrect === 1 };
}

async function queryOwnedMcq(id: string, userId: string): Promise<McqRow | null> {
	return queryOne<McqRow>(
		"SELECT id, name, question, created_by_user_id, created_at, updated_at FROM mcqs WHERE id = ?1 AND created_by_user_id = ?2",
		[id, userId],
	);
}

async function listChoices(mcqId: string): Promise<McqChoice[]> {
	const rows = await queryAll<ChoiceRow>(
		"SELECT id, mcq_id, choice_text, is_correct, position, created_at, updated_at FROM mcq_choices WHERE mcq_id = ?1 ORDER BY position ASC",
		[mcqId],
	);

	return rows
		.map((row) => ({
			id: row.id,
			mcqId: row.mcq_id,
			choiceText: row.choice_text,
			isCorrect: row.is_correct === 1,
			position: row.position,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}))
		.sort((left, right) => left.position - right.position);
}

async function insertChoice(choice: McqChoice): Promise<void> {
	await execute(
		"INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
		[
			choice.id,
			choice.mcqId,
			choice.choiceText,
			choice.isCorrect ? 1 : 0,
			choice.position,
			choice.createdAt,
			choice.updatedAt,
		],
	);
}

function toWritableChoice(
	mcqId: string,
	choice: McqWriteInput["choices"][number],
	position: number,
	createdAt: number,
	updatedAt: number,
	id = crypto.randomUUID(),
): McqChoice {
	return {
		id,
		mcqId,
		choiceText: choice.choiceText,
		isCorrect: choice.isCorrect,
		position,
		createdAt,
		updatedAt,
	};
}

function toMcq(row: McqRow): Mcq {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		createdByUserId: row.created_by_user_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}
