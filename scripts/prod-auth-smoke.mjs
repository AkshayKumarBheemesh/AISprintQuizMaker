import { chromium } from "@playwright/test";

const BASE = "https://aisprint-quizmaker.akshaykumar.workers.dev";
const email = `phase4-fix+${Date.now()}@example.test`;
const password = "password123";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(`${BASE}/register`);
await page.getByLabel("First name").fill("Ada");
await page.getByLabel("Last name").fill("Lovelace");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password", { exact: true }).fill(password);
await page.getByLabel("Confirm password").fill(password);
await page.getByRole("button", { name: /create account/i }).click();
await page.waitForURL("**/dashboard", { timeout: 30_000 });

const cookie = (await context.cookies()).find((item) => item.name === "quizmaker_session");
const dashboard = await page.getByRole("heading", { name: "MCQ Home" }).isVisible();
const name = await page.getByText("Ada Lovelace").isVisible();

await page.getByRole("button", { name: /log out/i }).click();
await page.waitForURL("**/login", { timeout: 15_000 });

await page.goto(`${BASE}/dashboard`);
await page.waitForURL("**/login", { timeout: 15_000 });

await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL("**/dashboard", { timeout: 30_000 });
const afterLogin = await page.getByRole("heading", { name: "MCQ Home" }).isVisible();

await page.getByRole("button", { name: /log out/i }).click();
await page.waitForURL("**/login", { timeout: 15_000 });

console.log(
	JSON.stringify(
		{
			email,
			dashboard,
			name,
			afterLogin,
			httpOnly: cookie?.httpOnly ?? false,
			hasSessionCookie: Boolean(cookie?.value),
			pageErrors: errors,
		},
		null,
		2,
	),
);

await browser.close();
