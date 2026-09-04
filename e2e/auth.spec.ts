import { expect, test, type Page } from "@playwright/test";

const SESSION_COOKIE = "quizmaker_session";
const PASSWORD = "password123";
const DEPLOYED_HOST = "aisprint-quizmaker.akshaykumar.workers.dev";

function uniqueUser(label = "Ada") {
	const token = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
	return {
		firstName: label,
		lastName: "Lovelace",
		email: `teacher+${token}@example.test`,
		password: PASSWORD,
	};
}

function cookieAttrs(page: Page) {
	const url = new URL(page.url());
	return {
		domain: url.hostname,
		path: "/",
		httpOnly: true,
		secure: url.protocol === "https:",
		sameSite: "Lax" as const,
	};
}

async function register(page: Page, user: ReturnType<typeof uniqueUser>) {
	await page.goto("/register");
	await expect(page).toHaveURL(new RegExp(`${DEPLOYED_HOST}/register`));
	await expect(page.getByRole("heading", { name: /create an account/i })).toBeVisible();
	await page.getByLabel("First name").fill(user.firstName);
	await page.getByLabel("Last name").fill(user.lastName);
	await page.getByLabel("Email").fill(user.email);
	await page.getByLabel("Password", { exact: true }).fill(user.password);
	await page.getByLabel("Confirm password").fill(user.password);
	await page.getByRole("button", { name: /create account/i }).click();
	await page.waitForURL("**/dashboard");
}

async function login(page: Page, user: ReturnType<typeof uniqueUser>) {
	await page.goto("/login");
	await page.getByLabel("Email").fill(user.email);
	await page.getByLabel("Password").fill(user.password);
	await page.getByRole("button", { name: /sign in/i }).click();
	await page.waitForURL("**/dashboard");
}

async function sessionCookie(page: Page) {
	const cookies = await page.context().cookies();
	return cookies.find((cookie) => cookie.name === SESSION_COOKIE);
}

test.describe("Sprint 1 authentication E2E", () => {
	test("E-1 / E-3 / E-2: register → dashboard → logout → login → dashboard", async ({
		page,
	}) => {
		const user = uniqueUser();

		await register(page, user);

		await expect(page).toHaveURL(new RegExp(`${DEPLOYED_HOST}/dashboard`));
		await expect(page.getByRole("heading", { name: "MCQ Home" })).toBeVisible();
		await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();
		await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();

		const body = await page.locator("body").innerText();
		expect(body).not.toContain(user.password);
		const cookie = await sessionCookie(page);
		expect(cookie).toBeDefined();
		expect(cookie?.httpOnly).toBe(true);
		expect(body).not.toContain(cookie?.value ?? "missing-session");

		await page.getByRole("button", { name: /log out/i }).click();
		await page.waitForURL("**/login");
		await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

		await page.goto("/dashboard");
		await page.waitForURL("**/login");

		await login(page, user);
		await expect(page).toHaveURL(new RegExp(`${DEPLOYED_HOST}/dashboard`));
		await expect(page.getByRole("heading", { name: "MCQ Home" })).toBeVisible();
		await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();
	});

	test("E-4: wrong password shows the generic error and stays on login", async ({ page }) => {
		const user = uniqueUser("Grace");
		await register(page, user);
		await page.getByRole("button", { name: /log out/i }).click();
		await page.waitForURL("**/login");

		await page.getByLabel("Email").fill(user.email);
		await page.getByLabel("Password").fill("wrong-password");
		await page.getByRole("button", { name: /sign in/i }).click();

		await expect(page.getByText("Incorrect email or password.")).toBeVisible();
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByLabel("Email")).not.toHaveAttribute("aria-errormessage");
	});

	test("E-8: duplicate email shows the specified account-exists message", async ({ page }) => {
		const user = uniqueUser("Kate");
		await register(page, user);
		await page.getByRole("button", { name: /log out/i }).click();
		await page.waitForURL("**/login");

		await page.goto("/register");
		await page.getByLabel("First name").fill(user.firstName);
		await page.getByLabel("Last name").fill(user.lastName);
		await page.getByLabel("Email").fill(user.email);
		await page.getByLabel("Password", { exact: true }).fill(user.password);
		await page.getByLabel("Confirm password").fill(user.password);
		await page.getByRole("button", { name: /create account/i }).click();

		await expect(page.getByText("An account with this email already exists.")).toBeVisible();
		await expect(page).toHaveURL(/\/register$/);
	});

	test("E-5: unauthenticated /dashboard redirects to /login", async ({ page }) => {
		await page.goto("/dashboard");
		await page.waitForURL("**/login");
		await expect(page).toHaveURL(new RegExp(`${DEPLOYED_HOST}/login`));
		await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
	});

	test("E-6 / E-7: a valid session can open /dashboard and is bounced off /login and /register", async ({
		page,
	}) => {
		const user = uniqueUser("Mary");
		await register(page, user);

		await page.goto("/dashboard");
		await expect(page).toHaveURL(new RegExp(`${DEPLOYED_HOST}/dashboard`));
		await expect(page.getByRole("heading", { name: "MCQ Home" })).toBeVisible();

		await page.goto("/login");
		await page.waitForURL("**/dashboard");
		await page.goto("/register");
		await page.waitForURL("**/dashboard");
	});

	test("forged session cookie is rejected on /dashboard", async ({ page, context }) => {
		await page.goto("/login");
		await context.addCookies([
			{
				name: SESSION_COOKIE,
				value: "forged-not-a-real-session",
				...cookieAttrs(page),
			},
		]);

		await page.goto("/dashboard");
		await page.waitForURL("**/login");
	});

	test("E-9: a logged-out session cookie cannot be replayed", async ({ page, context }) => {
		const user = uniqueUser("Eve");
		await register(page, user);

		const cookie = await sessionCookie(page);
		expect(cookie?.value).toBeTruthy();

		await page.getByRole("button", { name: /log out/i }).click();
		await page.waitForURL("**/login");
		expect(await sessionCookie(page)).toBeUndefined();

		await context.addCookies([
			{
				name: SESSION_COOKIE,
				value: cookie!.value,
				...cookieAttrs(page),
			},
		]);

		await page.goto("/dashboard");
		await page.waitForURL("**/login");
		await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
	});
});
