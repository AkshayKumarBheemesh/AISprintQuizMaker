import { expect, test, type Page } from "@playwright/test";

import { assertLocalPreview, registerLocal, uniqueTeacher } from "./helpers/local-auth";

function choiceText(page: Page, index: number) {
	return page.getByRole("textbox", { name: `Choice ${index}` });
}

async function openRowAction(page: Page, name: string, action: "Edit" | "Preview" | "Delete") {
	await page.getByRole("button", { name: `Actions for ${name}` }).click();
	await page.getByRole("menuitem", { name: action }).click();
}

async function choiceIdsOnEdit(page: Page) {
	const first = page.locator('input[name="choices.0.id"]');
	const second = page.locator('input[name="choices.1.id"]');
	await expect(first).toHaveCount(1);
	return {
		first: await first.inputValue(),
		second: await second.inputValue(),
	};
}

test.describe("Sprint 2 MCQ E2E (local preview + local D1)", () => {
	test.beforeAll(() => {
		const baseURL = test.info().project.use.baseURL ?? "";
		if (!baseURL || /workers\.dev/i.test(baseURL)) {
			throw new Error(
				"MCQ E2E refused to start: baseURL is missing or points at workers.dev. " +
					"Run `npm run e2e:mcq` so tests use playwright.mcq.config.ts and local D1.",
			);
		}
		const host = new URL(baseURL).hostname;
		if (!["127.0.0.1", "localhost"].includes(host)) {
			throw new Error(`MCQ E2E refused to start: ${baseURL} is not local preview.`);
		}
	});

	test("unauthenticated MCQ routes redirect to login", async ({ page }) => {
		for (const path of [
			"/dashboard",
			"/dashboard/mcqs/new",
			"/dashboard/mcqs/not-a-real-id/edit",
			"/dashboard/mcqs/not-a-real-id/preview",
		]) {
			await page.goto(path);
			await page.waitForURL("**/login");
			assertLocalPreview(page);
			await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
		}
	});

	test("teacher can author, preview, attempt, and delete an MCQ", async ({ page }) => {
		test.setTimeout(180_000);

		const user = uniqueTeacher();
		const originalName = `Capitals ${user.token}`;
		const originalQuestion = `What is the capital of France? ${user.token}`;
		const editedName = `Capitals edited ${user.token}`;
		const editedQuestion = `What is the capital of Spain? ${user.token}`;

		await registerLocal(page, user);

		await expect(page).toHaveURL(/\/dashboard$/);
		await expect(page.getByRole("heading", { name: "MCQ Home" })).toBeVisible();
		await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();
		await expect(page.getByRole("link", { name: "Create" })).toBeVisible();
		await expect(page.getByText("No questions yet.")).toBeVisible();

		await page.getByRole("link", { name: "Create" }).click();
		await page.waitForURL("**/dashboard/mcqs/new");
		assertLocalPreview(page);
		await expect(page.getByRole("heading", { name: /create/i })).toBeVisible();
		await expect(page.getByLabel("Name")).toBeVisible();
		await expect(page.getByLabel("Question")).toBeVisible();
		await expect(choiceText(page, 1)).toBeVisible();
		await expect(choiceText(page, 2)).toBeVisible();
		await expect(choiceText(page, 3)).toHaveCount(0);

		await expect(page.getByRole("button", { name: "Remove choice 1" })).toBeDisabled();
		await expect(page.getByRole("button", { name: "Remove choice 2" })).toBeDisabled();

		const addChoice = page.getByRole("button", { name: "Add choice" });
		for (let count = 2; count < 6; count += 1) {
			await addChoice.click();
			await expect(choiceText(page, count + 1)).toBeVisible();
		}
		await expect(choiceText(page, 6)).toBeVisible();
		await expect(choiceText(page, 7)).toHaveCount(0);
		await expect(addChoice).toBeDisabled();
		await addChoice.click({ force: true });
		await expect(choiceText(page, 7)).toHaveCount(0);

		for (let count = 6; count > 2; count -= 1) {
			await page.getByRole("button", { name: `Remove choice ${count}` }).click();
			await expect(choiceText(page, count)).toHaveCount(0);
		}
		await expect(page.getByRole("button", { name: "Remove choice 1" })).toBeDisabled();
		await expect(page.getByRole("button", { name: "Remove choice 2" })).toBeDisabled();

		await page.getByLabel("Name").fill(originalName);
		await page.getByLabel("Question").fill(originalQuestion);
		await choiceText(page, 1).fill("Paris");
		await choiceText(page, 2).fill("Lyon");

		const correctOne = page.getByRole("radio", { name: "Choice 1 is correct" });
		const correctTwo = page.getByRole("radio", { name: "Choice 2 is correct" });
		await correctTwo.click();
		await expect(correctTwo).toBeChecked();
		await expect(correctOne).not.toBeChecked();
		await correctOne.click();
		await expect(correctOne).toBeChecked();
		await expect(correctTwo).not.toBeChecked();

		await page.getByRole("button", { name: /save/i }).click();
		await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
		assertLocalPreview(page);
		await expect(page.getByText(originalName)).toBeVisible();
		await expect(page.getByText(originalQuestion)).toBeVisible();
		await expect(page.getByText("No questions yet.")).toHaveCount(0);

		await openRowAction(page, originalName, "Edit");
		await page.waitForURL(/\/dashboard\/mcqs\/[^/]+\/edit$/);
		assertLocalPreview(page);
		await expect(page.getByRole("heading", { name: /edit/i })).toBeVisible();
		await expect(page.getByLabel("Name")).toHaveValue(originalName);
		await expect(page.getByLabel("Question")).toHaveValue(originalQuestion);
		await expect(choiceText(page, 1)).toHaveValue("Paris");
		await expect(choiceText(page, 2)).toHaveValue("Lyon");
		await expect(correctOne).toBeChecked();

		const idsBeforeSave = await choiceIdsOnEdit(page);
		expect(idsBeforeSave.first).toMatch(/^[0-9a-f-]{36}$/i);
		expect(idsBeforeSave.second).toMatch(/^[0-9a-f-]{36}$/i);
		expect(idsBeforeSave.first).not.toBe(idsBeforeSave.second);

		await page.getByLabel("Name").fill(editedName);
		await page.getByLabel("Question").fill(editedQuestion);
		await choiceText(page, 1).fill("Madrid");
		await choiceText(page, 2).fill("Barcelona");
		await page.getByRole("button", { name: /save/i }).click();
		await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
		await expect(page.getByText(editedName)).toBeVisible();
		await expect(page.getByText(editedQuestion)).toBeVisible();
		await expect(page.getByText(originalName)).toHaveCount(0);

		await openRowAction(page, editedName, "Edit");
		await page.waitForURL(/\/dashboard\/mcqs\/[^/]+\/edit$/);
		const idsAfterSave = await choiceIdsOnEdit(page);
		expect(idsAfterSave).toEqual(idsBeforeSave);
		await page.getByRole("link", { name: /cancel/i }).click();
		await page.waitForURL("**/dashboard");

		await openRowAction(page, editedName, "Preview");
		await page.waitForURL(/\/dashboard\/mcqs\/[^/]+\/preview$/);
		assertLocalPreview(page);
		await expect(page.getByRole("heading", { name: editedName })).toBeVisible();
		await expect(page.getByText(editedQuestion)).toBeVisible();
		await expect(page.getByText("Madrid")).toBeVisible();
		await expect(page.getByText("Barcelona")).toBeVisible();
		await expect(page.getByRole("button", { name: /submit/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
		await expect(page.getByText(/^Correct$/)).toHaveCount(0);
		await expect(page.getByText(/^Incorrect$/)).toHaveCount(0);

		await page.getByText("Barcelona", { exact: true }).click();
		await page.getByRole("button", { name: /submit/i }).click();
		await expect(page.getByText(/^Incorrect$/)).toBeVisible();
		await expect(page.getByText(/^Correct$/)).toHaveCount(0);

		await page.getByText("Madrid", { exact: true }).click();
		await page.getByRole("button", { name: /submit/i }).click();
		await expect(page.getByText(/^Correct$/)).toBeVisible();
		await expect(page.getByText(/^Incorrect$/)).toHaveCount(0);

		await page.goto("/dashboard");
		await expect(page.getByText(editedName)).toBeVisible();

		await openRowAction(page, editedName, "Delete");
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("heading", { name: "Delete question" })).toBeVisible();
		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).toHaveCount(0);
		await expect(page.getByText(editedName)).toBeVisible();

		await openRowAction(page, editedName, "Delete");
		await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
		await page.waitForURL("**/dashboard");
		await expect(page.getByText(editedName)).toHaveCount(0);
		await expect(page.getByText("No questions yet.")).toBeVisible();
	});

	test("second teacher cannot open another teacher's MCQ", async ({ page, browser }) => {
		test.setTimeout(180_000);

		const owner = uniqueTeacher("Owner");
		const name = `Owner only ${owner.token}`;
		await registerLocal(page, owner);
		await page.getByRole("link", { name: "Create" }).click();
		await page.waitForURL("**/dashboard/mcqs/new");
		await page.getByLabel("Name").fill(name);
		await page.getByLabel("Question").fill(`Secret question ${owner.token}`);
		await choiceText(page, 1).fill("Alpha");
		await choiceText(page, 2).fill("Beta");
		await page.getByRole("radio", { name: "Choice 1 is correct" }).click();
		await page.getByRole("button", { name: /save/i }).click();
		await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });

		await openRowAction(page, name, "Edit");
		await page.waitForURL(/\/dashboard\/mcqs\/[^/]+\/edit$/);
		const editUrl = page.url();
		const previewUrl = editUrl.replace(/\/edit$/, "/preview");

		const otherContext = await browser.newContext();
		const otherPage = await otherContext.newPage();
		const other = uniqueTeacher("Other");
		await registerLocal(otherPage, other);
		await expect(otherPage.getByText(name)).toHaveCount(0);

		await otherPage.goto(editUrl);
		await otherPage.waitForURL("**/dashboard");
		assertLocalPreview(otherPage);
		await expect(otherPage.getByLabel("Name")).toHaveCount(0);
		await expect(otherPage.getByText(name)).toHaveCount(0);

		await otherPage.goto(previewUrl);
		await otherPage.waitForURL("**/dashboard");
		await expect(otherPage.getByRole("button", { name: /submit/i })).toHaveCount(0);
		await expect(otherPage.getByText(name)).toHaveCount(0);

		await otherContext.close();
	});
});
