import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		// jsdom does not implement SubtleCrypto, which the PBKDF2 tests require. Component
		// tests opt into jsdom per file with a `@vitest-environment jsdom` docblock.
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		exclude: ["node_modules/**", ".next/**", ".open-next/**", "e2e/**"],
	},
	resolve: {
		alias: {
			"@": path.resolve(process.cwd(), "src"),
		},
	},
});
