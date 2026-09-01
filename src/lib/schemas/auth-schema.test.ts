import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "./auth-schema";

function validRegisterInput(overrides: Record<string, string> = {}) {
	return {
		firstName: "Ada",
		lastName: "Lovelace",
		email: "ada@school.org",
		password: "password123",
		confirmPassword: "password123",
		...overrides,
	};
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[], field: string) {
	return issues.filter((issue) => issue.path[0] === field).map((issue) => issue.message);
}

describe("registerSchema", () => {
	it("accepts a valid registration", () => {
		const result = registerSchema.safeParse(validRegisterInput());

		expect(result.success).toBe(true);
	});

	it.each([
		["firstName", ""],
		["firstName", "   "],
		["lastName", ""],
		["lastName", "   "],
	])("A-1: rejects a missing %s", (field, value) => {
		const result = registerSchema.safeParse(validRegisterInput({ [field]: value }));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, field).length).toBeGreaterThan(0);
	});

	it.each([
		["no at sign", "not-an-email"],
		["no domain", "ada@"],
		["empty", ""],
		["spaces only", "   "],
	])("A-2: rejects a malformed email (%s)", (_label, email) => {
		const result = registerSchema.safeParse(validRegisterInput({ email }));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "email").length).toBeGreaterThan(0);
	});

	it.each([
		["seven characters", "1234567"],
		["empty", ""],
	])("A-3: rejects a password under 8 characters (%s)", (_label, password) => {
		const result = registerSchema.safeParse(
			validRegisterInput({ password, confirmPassword: password }),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "password").length).toBeGreaterThan(0);
	});

	it("A-3: accepts a password of exactly 8 characters", () => {
		const result = registerSchema.safeParse(
			validRegisterInput({ password: "12345678", confirmPassword: "12345678" }),
		);

		expect(result.success).toBe(true);
	});

	it("A-4: rejects mismatched password and confirmation", () => {
		const result = registerSchema.safeParse(
			validRegisterInput({ password: "password123", confirmPassword: "password124" }),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "confirmPassword")).toContain(
			"Passwords do not match.",
		);
	});

	it("A-4: reports the mismatch on the confirmation field, not the password field", () => {
		const result = registerSchema.safeParse(
			validRegisterInput({ confirmPassword: "different" }),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrors(result.error.issues, "password")).toHaveLength(0);
	});

	it("normalizes the email to trimmed lowercase", () => {
		const result = registerSchema.safeParse(
			validRegisterInput({ email: "  Ada@School.ORG  " }),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.email).toBe("ada@school.org");
	});

	it("trims the first and last name", () => {
		const result = registerSchema.safeParse(
			validRegisterInput({ firstName: "  Ada  ", lastName: "  Lovelace  " }),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.firstName).toBe("Ada");
		expect(result.data.lastName).toBe("Lovelace");
	});

	it("does not trim the password, since whitespace is legitimate", () => {
		const result = registerSchema.safeParse(
			validRegisterInput({ password: " pass word ", confirmPassword: " pass word " }),
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.password).toBe(" pass word ");
	});
});

describe("loginSchema", () => {
	it("accepts valid credentials", () => {
		const result = loginSchema.safeParse({ email: "ada@school.org", password: "password123" });

		expect(result.success).toBe(true);
	});

	it("A-8: rejects a malformed email", () => {
		const result = loginSchema.safeParse({ email: "nope", password: "password123" });

		expect(result.success).toBe(false);
	});

	it("A-8: rejects an empty password", () => {
		const result = loginSchema.safeParse({ email: "ada@school.org", password: "" });

		expect(result.success).toBe(false);
	});

	it("A-8: rejects entirely missing fields", () => {
		const result = loginSchema.safeParse({});

		expect(result.success).toBe(false);
	});

	it("does not enforce the 8-character minimum, which would leak password length policy", () => {
		const result = loginSchema.safeParse({ email: "ada@school.org", password: "short" });

		expect(result.success).toBe(true);
	});

	it("normalizes the email to trimmed lowercase", () => {
		const result = loginSchema.safeParse({
			email: "  Ada@School.ORG ",
			password: "password123",
		});

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.email).toBe("ada@school.org");
	});
});
