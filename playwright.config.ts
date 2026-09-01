import { defineConfig } from "@playwright/test";

const DEPLOYED_URL = "https://aisprint-quizmaker.akshaykumar.workers.dev";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEPLOYED_URL;

export default defineConfig({
	testDir: "e2e",
	fullyParallel: false,
	workers: 1,
	timeout: 60_000,
	expect: { timeout: 20_000 },
	use: {
		baseURL,
		trace: "retain-on-failure",
	},
});
