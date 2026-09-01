import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
	it("U-7: trims surrounding whitespace", () => {
		expect(normalizeEmail("  teacher@school.org  ")).toBe("teacher@school.org");
	});

	it("U-7: lowercases the address", () => {
		expect(normalizeEmail("Teacher@School.ORG")).toBe("teacher@school.org");
	});

	it("U-8: maps padded, mixed-case input to the same stored form", () => {
		expect(normalizeEmail("  Teacher@School.org ")).toBe(normalizeEmail("teacher@school.org"));
	});

	it("leaves an already-normalized address unchanged", () => {
		expect(normalizeEmail("teacher@school.org")).toBe("teacher@school.org");
	});
});
