import { z } from "zod";

import { normalizeEmail } from "@/lib/auth/email";

const emailField = z
	.string()
	.trim()
	.pipe(z.email("Enter a valid email address."))
	.transform(normalizeEmail);

export const registerSchema = z
	.object({
		firstName: z.string().trim().min(1, "First name is required."),
		lastName: z.string().trim().min(1, "Last name is required."),
		email: emailField,
		password: z.string().min(8, "Password must be at least 8 characters."),
		confirmPassword: z.string().min(1, "Confirm your password."),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match.",
		path: ["confirmPassword"],
	});

/**
 * Deliberately does not enforce the 8-character minimum. Rejecting a short password at
 * the login form would reveal the stored password policy and lock out any account
 * created before a future policy change.
 */
export const loginSchema = z.object({
	email: emailField,
	password: z.string().min(1, "Password is required."),
});

export type RegisterFields = z.infer<typeof registerSchema>;
export type LoginFields = z.infer<typeof loginSchema>;
