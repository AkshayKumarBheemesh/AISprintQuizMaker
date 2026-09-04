import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/d1-client", () => ({
	queryAll: vi.fn(),
	queryOne: vi.fn(),
	execute: vi.fn(),
	batch: vi.fn(),
}));

import { batch, execute, queryAll, queryOne } from "@/lib/d1-client";

import {
	createMcq,
	deleteMcq,
	getMcq,
	listMcqs,
	recordAttempt,
	updateMcq,
} from "./mcq-service";

const mockQueryAll = vi.mocked(queryAll);
const mockQueryOne = vi.mocked(queryOne);
const mockExecute = vi.mocked(execute);
const mockBatch = vi.mocked(batch);

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const MCQ_ID = "mcq-1";

function validWriteInput(
	overrides: {
		name?: string;
		question?: string;
		choices?: { id?: string; choiceText: string; isCorrect: boolean }[];
	} = {},
) {
	return {
		name: "Capitals",
		question: "What is the capital of France?",
		choices: [
			{ choiceText: "Paris", isCorrect: true },
			{ choiceText: "Lyon", isCorrect: false },
		],
		...overrides,
	};
}

function mcqRow(overrides: Record<string, unknown> = {}) {
	return {
		id: MCQ_ID,
		name: "Capitals",
		question: "What is the capital of France?",
		created_by_user_id: USER_ID,
		created_at: 1_700_000_000,
		updated_at: 1_700_000_000,
		...overrides,
	};
}

function choiceRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "choice-1",
		mcq_id: MCQ_ID,
		choice_text: "Paris",
		is_correct: 1,
		position: 0,
		created_at: 1_700_000_000,
		updated_at: 1_700_000_000,
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockExecute.mockResolvedValue(undefined);
	mockBatch.mockResolvedValue(undefined);
	mockQueryAll.mockResolvedValue([]);
	mockQueryOne.mockResolvedValue(null);
});

describe("listMcqs", () => {
	it("returns only the authenticated user's MCQs, newest first", async () => {
		mockQueryAll.mockResolvedValue([mcqRow()]);

		const result = await listMcqs(USER_ID);

		expect(result).toEqual([
			{
				id: MCQ_ID,
				name: "Capitals",
				question: "What is the capital of France?",
				createdByUserId: USER_ID,
				createdAt: 1_700_000_000,
				updatedAt: 1_700_000_000,
			},
		]);

		const [sql, params] = mockQueryAll.mock.calls[0];
		expect(sql).toContain("FROM mcqs");
		expect(sql).toContain("created_by_user_id = ?1");
		expect(sql).toMatch(/ORDER BY created_at DESC/i);
		expect(sql).not.toContain("*");
		expect(params).toEqual([USER_ID]);
	});
});

describe("getMcq", () => {
	it("returns the owned MCQ and its choices in position order", async () => {
		mockQueryOne.mockResolvedValue(mcqRow());
		mockQueryAll.mockResolvedValue([
			choiceRow({ id: "choice-2", choice_text: "Lyon", is_correct: 0, position: 1 }),
			choiceRow(),
		]);

		const result = await getMcq(MCQ_ID, USER_ID);

		expect(result).toMatchObject({
			id: MCQ_ID,
			name: "Capitals",
			createdByUserId: USER_ID,
		});
		expect(result?.choices).toHaveLength(2);
		expect(result?.choices[0]).toMatchObject({
			id: "choice-1",
			choiceText: "Paris",
			isCorrect: true,
			position: 0,
		});
		expect(result?.choices[1]).toMatchObject({
			id: "choice-2",
			choiceText: "Lyon",
			isCorrect: false,
			position: 1,
		});

		const [sql, params] = mockQueryOne.mock.calls[0];
		expect(sql).toContain("FROM mcqs");
		expect(sql).toContain("id = ?1");
		expect(sql).toContain("created_by_user_id = ?2");
		expect(sql).not.toContain("*");
		expect(params).toEqual([MCQ_ID, USER_ID]);

		const [choiceSql, choiceParams] = mockQueryAll.mock.calls[0];
		expect(choiceSql).toContain("FROM mcq_choices");
		expect(choiceSql).toMatch(/ORDER BY position ASC/i);
		expect(choiceParams).toEqual([MCQ_ID]);
	});

	it("returns null when the MCQ is missing or owned by another user", async () => {
		mockQueryOne.mockResolvedValue(null);

		await expect(getMcq(MCQ_ID, OTHER_USER_ID)).resolves.toBeNull();
		expect(mockQueryAll).not.toHaveBeenCalled();
	});
});

describe("createMcq", () => {
	it("inserts the MCQ and choices using the authenticated user id", async () => {
		const result = await createMcq(USER_ID, validWriteInput());

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.mcq.createdByUserId).toBe(USER_ID);
		expect(result.mcq.name).toBe("Capitals");
		expect(result.mcq.choices).toHaveLength(2);
		expect(result.mcq.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);

		const [mcqSql, mcqParams = []] = mockExecute.mock.calls[0];
		expect(mcqSql).toContain("INSERT INTO mcqs");
		expect(mcqSql).toContain("?1");
		expect(mcqSql).not.toContain(USER_ID);
		expect(mcqParams).toContain(USER_ID);
		expect(mcqParams).not.toContain("user-from-client");

		const choiceInserts = mockExecute.mock.calls.slice(1);
		expect(choiceInserts).toHaveLength(2);
		expect(choiceInserts[0]?.[0]).toContain("INSERT INTO mcq_choices");
		expect(choiceInserts[0]?.[1]).toContain(1);
		expect(choiceInserts[1]?.[1]).toContain(0);
	});

	it("assigns sequential positions from the submitted order", async () => {
		await createMcq(USER_ID, validWriteInput());

		const firstChoiceParams = mockExecute.mock.calls[1]?.[1] ?? [];
		const secondChoiceParams = mockExecute.mock.calls[2]?.[1] ?? [];
		expect(firstChoiceParams).toContain(0);
		expect(secondChoiceParams).toContain(1);
	});

	it("rejects fewer than two choices before writing", async () => {
		const result = await createMcq(
			USER_ID,
			validWriteInput({
				choices: [{ choiceText: "Paris", isCorrect: true }],
			}),
		);

		expect(result).toEqual({ ok: false, error: "INVALID_CHOICES" });
		expect(mockExecute).not.toHaveBeenCalled();
	});

	it("rejects more than six choices before writing", async () => {
		const result = await createMcq(
			USER_ID,
			validWriteInput({
				choices: [
					{ choiceText: "A", isCorrect: true },
					{ choiceText: "B", isCorrect: false },
					{ choiceText: "C", isCorrect: false },
					{ choiceText: "D", isCorrect: false },
					{ choiceText: "E", isCorrect: false },
					{ choiceText: "F", isCorrect: false },
					{ choiceText: "G", isCorrect: false },
				],
			}),
		);

		expect(result).toEqual({ ok: false, error: "INVALID_CHOICES" });
		expect(mockExecute).not.toHaveBeenCalled();
	});

	it("rejects a correct-choice count other than one", async () => {
		const result = await createMcq(
			USER_ID,
			validWriteInput({
				choices: [
					{ choiceText: "Paris", isCorrect: true },
					{ choiceText: "Lyon", isCorrect: true },
				],
			}),
		);

		expect(result).toEqual({ ok: false, error: "INVALID_CHOICES" });
		expect(mockExecute).not.toHaveBeenCalled();
	});
});

describe("updateMcq", () => {
	function existingChoices() {
		return [
			choiceRow({ id: "choice-1", choice_text: "Paris", is_correct: 1, position: 0 }),
			choiceRow({
				id: "choice-2",
				choice_text: "Lyon",
				is_correct: 0,
				position: 1,
			}),
		];
	}

	it("returns not found for another user's MCQ", async () => {
		mockQueryOne.mockResolvedValue(null);

		const result = await updateMcq(MCQ_ID, OTHER_USER_ID, validWriteInput());

		expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
		expect(mockExecute).not.toHaveBeenCalled();
		expect(mockBatch).not.toHaveBeenCalled();
	});

	it("updates name and question and preserves existing choice IDs", async () => {
		mockQueryOne.mockResolvedValue(mcqRow());
		mockQueryAll.mockResolvedValue(existingChoices());

		const result = await updateMcq(
			MCQ_ID,
			USER_ID,
			validWriteInput({
				name: "European capitals",
				question: "Which city is the capital of France?",
				choices: [
					{ id: "choice-1", choiceText: "Paris", isCorrect: true },
					{ id: "choice-2", choiceText: "Marseille", isCorrect: false },
				],
			}),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.mcq.choices.map((choice) => choice.id)).toEqual(["choice-1", "choice-2"]);

		const statements = mockBatch.mock.calls[0]?.[0] ?? [];
		const updateMcqCall = statements.find((statement) => statement.sql.includes("UPDATE mcqs"));
		expect(updateMcqCall?.sql).toContain("?1");
		expect(updateMcqCall?.params).toEqual(
			expect.arrayContaining(["European capitals", "Which city is the capital of France?"]),
		);

		const choiceUpdates = statements.filter(
			(statement) =>
				statement.sql.includes("UPDATE mcq_choices") &&
				statement.sql.includes("choice_text"),
		);
		expect(choiceUpdates).toHaveLength(2);
		expect(choiceUpdates[0]?.params).toContain("choice-1");
		expect(choiceUpdates[1]?.params).toContain("choice-2");
		expect(statements.flatMap((statement) => statement.params ?? [])).not.toContain("choice-3");
	});

	it("clears every is_correct flag in the same batch before setting the new correct choice", async () => {
		mockQueryOne.mockResolvedValue(mcqRow());
		mockQueryAll.mockResolvedValue([
			choiceRow({ id: "choice-1", choice_text: "NEW DELHI", is_correct: 0, position: 0 }),
			choiceRow({ id: "choice-2", choice_text: "MUMBAI", is_correct: 0, position: 1 }),
			choiceRow({ id: "choice-3", choice_text: "PUNE", is_correct: 1, position: 2 }),
		]);

		const result = await updateMcq(
			MCQ_ID,
			USER_ID,
			validWriteInput({
				choices: [
					{ id: "choice-1", choiceText: "NEW DELHI", isCorrect: false },
					{ id: "choice-2", choiceText: "MUMBAI", isCorrect: true },
					{ id: "choice-3", choiceText: "PUNE", isCorrect: false },
				],
			}),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.mcq.choices.map((choice) => choice.isCorrect)).toEqual([false, true, false]);

		expect(mockBatch).toHaveBeenCalledTimes(1);
		const statements = mockBatch.mock.calls[0]?.[0] ?? [];
		const sqlOrder = statements.map((statement) => statement.sql);

		const clearIndex = sqlOrder.findIndex(
			(sql) => sql.includes("UPDATE mcq_choices SET is_correct = 0") && sql.includes("mcq_id"),
		);
		const setCorrectIndex = statements.findIndex(
			(statement) =>
				statement.sql.includes("UPDATE mcq_choices") &&
				statement.sql.includes("choice_text") &&
				statement.params?.[1] === 1,
		);

		expect(clearIndex).toBeGreaterThanOrEqual(0);
		expect(setCorrectIndex).toBeGreaterThan(clearIndex);
		expect(statements[clearIndex]?.params).toEqual([MCQ_ID]);
		expect(statements.some((statement) => statement.sql.includes("UPDATE mcq_attempts"))).toBe(
			false,
		);
	});

	it("can move the correct choice from the first row to a later row", async () => {
		mockQueryOne.mockResolvedValue(mcqRow());
		mockQueryAll.mockResolvedValue(existingChoices());

		const result = await updateMcq(
			MCQ_ID,
			USER_ID,
			validWriteInput({
				choices: [
					{ id: "choice-1", choiceText: "Paris", isCorrect: false },
					{ id: "choice-2", choiceText: "Lyon", isCorrect: true },
				],
			}),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.mcq.choices.map((choice) => choice.isCorrect)).toEqual([false, true]);
		expect(mockBatch).toHaveBeenCalledTimes(1);
	});

	it("inserts added choices and deletes removed choices plus their attempts", async () => {
		mockQueryOne.mockResolvedValue(mcqRow());
		mockQueryAll.mockResolvedValue(existingChoices());

		const result = await updateMcq(
			MCQ_ID,
			USER_ID,
			validWriteInput({
				choices: [
					{ id: "choice-1", choiceText: "Paris", isCorrect: true },
					{ choiceText: "Nice", isCorrect: false },
				],
			}),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.mcq.choices).toHaveLength(2);
		expect(result.mcq.choices[0]?.id).toBe("choice-1");
		expect(result.mcq.choices[1]?.id).not.toBe("choice-2");

		const statements = mockBatch.mock.calls[0]?.[0] ?? [];
		const sqlOrder = statements.map((statement) => statement.sql);
		const deleteAttemptsIndex = sqlOrder.findIndex(
			(sql) => sql.includes("DELETE FROM mcq_attempts") && sql.includes("choice_id"),
		);
		const deleteChoiceIndex = sqlOrder.findIndex((sql) =>
			sql.includes("DELETE FROM mcq_choices"),
		);
		const insertChoiceIndex = sqlOrder.findIndex((sql) =>
			sql.includes("INSERT INTO mcq_choices"),
		);

		expect(deleteAttemptsIndex).toBeGreaterThanOrEqual(0);
		expect(deleteChoiceIndex).toBeGreaterThan(deleteAttemptsIndex);
		expect(insertChoiceIndex).toBeGreaterThanOrEqual(0);

		const deletedChoiceParams = statements[deleteChoiceIndex]?.params ?? [];
		expect(deletedChoiceParams).toContain("choice-2");
		expect(sqlOrder.some((sql) => sql.includes("UPDATE mcq_attempts"))).toBe(false);
	});
});

describe("deleteMcq", () => {
	it("returns not found for another user's MCQ", async () => {
		mockQueryOne.mockResolvedValue(null);

		const result = await deleteMcq(MCQ_ID, OTHER_USER_ID);

		expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
		expect(mockExecute).not.toHaveBeenCalled();
	});

	it("deletes attempts, then choices, then the MCQ", async () => {
		mockQueryOne.mockResolvedValue(mcqRow());

		const result = await deleteMcq(MCQ_ID, USER_ID);

		expect(result).toEqual({ ok: true });
		expect(mockExecute.mock.calls.map(([sql]) => sql)).toEqual([
			expect.stringContaining("DELETE FROM mcq_attempts"),
			expect.stringContaining("DELETE FROM mcq_choices"),
			expect.stringContaining("DELETE FROM mcqs"),
		]);

		const [attemptSql, attemptParams] = mockExecute.mock.calls[0];
		expect(attemptSql).toContain("mcq_id = ?1");
		expect(attemptParams).toEqual([MCQ_ID]);

		const [mcqSql, mcqParams] = mockExecute.mock.calls[2];
		expect(mcqSql).toContain("id = ?1");
		expect(mcqSql).toContain("created_by_user_id = ?2");
		expect(mcqParams).toEqual([MCQ_ID, USER_ID]);
	});
});

describe("recordAttempt", () => {
	it("records a correct attempt using the stored choice flag", async () => {
		mockQueryOne
			.mockResolvedValueOnce(mcqRow())
			.mockResolvedValueOnce(choiceRow({ id: "choice-1", is_correct: 1 }));

		const result = await recordAttempt(USER_ID, MCQ_ID, "choice-1");

		expect(result).toMatchObject({ ok: true, isCorrect: true });
		if (!result.ok) return;
		expect(result.attemptId).toBeTruthy();

		const [sql, params = []] = mockExecute.mock.calls[0];
		expect(sql).toContain("INSERT INTO mcq_attempts");
		expect(sql).toContain("?1");
		expect(params).toContain(USER_ID);
		expect(params).toContain(MCQ_ID);
		expect(params).toContain("choice-1");
		expect(params).toContain(1);
	});

	it("records an incorrect attempt using the stored choice flag", async () => {
		mockQueryOne
			.mockResolvedValueOnce(mcqRow())
			.mockResolvedValueOnce(choiceRow({ id: "choice-2", is_correct: 0 }));

		const result = await recordAttempt(USER_ID, MCQ_ID, "choice-2");

		expect(result).toEqual(expect.objectContaining({ ok: true, isCorrect: false }));

		const [, params = []] = mockExecute.mock.calls[0];
		expect(params).toContain(0);
		expect(params).not.toContain(1);
	});

	it("does not persist a client-supplied correctness or user id", async () => {
		mockQueryOne
			.mockResolvedValueOnce(mcqRow())
			.mockResolvedValueOnce(choiceRow({ id: "choice-2", is_correct: 0 }));

		await recordAttempt(
			USER_ID,
			MCQ_ID,
			"choice-2",
			// @ts-expect-error — callers must not be able to pass a client verdict
			{ isCorrect: true, userId: "attacker" },
		);

		const [, params = []] = mockExecute.mock.calls[0];
		expect(params).toContain(USER_ID);
		expect(params).toContain(0);
		expect(params).not.toContain("attacker");
		expect(params).not.toContain(true);
	});

	it("returns not found when the MCQ is missing or not owned", async () => {
		mockQueryOne.mockResolvedValue(null);

		await expect(recordAttempt(OTHER_USER_ID, MCQ_ID, "choice-1")).resolves.toEqual({
			ok: false,
			error: "NOT_FOUND",
		});
		expect(mockExecute).not.toHaveBeenCalled();
	});

	it("rejects a choice that does not belong to the MCQ", async () => {
		mockQueryOne.mockResolvedValueOnce(mcqRow()).mockResolvedValueOnce(null);

		await expect(recordAttempt(USER_ID, MCQ_ID, "foreign-choice")).resolves.toEqual({
			ok: false,
			error: "INVALID_CHOICE",
		});
		expect(mockExecute).not.toHaveBeenCalled();
	});
});
