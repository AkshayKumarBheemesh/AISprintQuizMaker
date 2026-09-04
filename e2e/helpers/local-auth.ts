import { expect, type Page } from "@playwright/test";

const PASSWORD = "password123";

export function uniqueTeacher(label = "Ada") {
	const token = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
	return {
		firstName: label,
		lastName: "Lovelace",
		email: `teacher+${token}@example.test`,
		password: PASSWORD,
		token,
	};
}

export function assertLocalPreview(page: Page) {
	const url = page.url();
	expect(url, "MCQ E2E must not target production").not.toMatch(/workers\.dev/i);
	const host = new URL(url).hostname;
	expect(["127.0.0.1", "localhost"]).toContain(host);
}

export async function registerLocal(page: Page, user: ReturnType<typeof uniqueTeacher>) {
	await page.goto("/register");
	assertLocalPreview(page);
	await expect(page.getByRole("heading", { name: /create an account/i })).toBeVisible();
	await page.getByLabel("First name").fill(user.firstName);
	await page.getByLabel("Last name").fill(user.lastName);
	await page.getByLabel("Email").fill(user.email);
	await page.getByLabel("Password", { exact: true }).fill(user.password);
	await page.getByLabel("Confirm password").fill(user.password);
	await page.getByRole("button", { name: /create account/i }).click();
	await page.waitForURL("**/dashboard");
	assertLocalPreview(page);
}
