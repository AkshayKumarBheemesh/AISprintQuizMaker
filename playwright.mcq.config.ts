import { defineConfig } from "@playwright/test";

const LOCAL_PREVIEW_URL = "http://127.0.0.1:8787";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? LOCAL_PREVIEW_URL;

if (/workers\.dev/i.test(baseURL) || /aisprint-quizmaker\.akshaykumar/i.test(baseURL)) {
	throw new Error(
		"Sprint 2 MCQ E2E must target local preview + local D1. " +
			"Unset PLAYWRIGHT_BASE_URL or point it at http://127.0.0.1:8787. " +
			"Do not use workers.dev.",
	);
}

export default defineConfig({
	testDir: "e2e",
	testMatch: "mcq.spec.ts",
	fullyParallel: false,
	workers: 1,
	timeout: 90_000,
	expect: { timeout: 20_000 },
	use: {
		baseURL,
		trace: "retain-on-failure",
	},
	webServer: {
		command: "npm run preview",
		url: baseURL,
		reuseExistingServer: true,
		timeout: 600_000,
	},
});
