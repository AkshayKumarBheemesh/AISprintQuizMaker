"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DUPLICATE_EMAIL_MESSAGE, INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/errors";
import { SESSION_DURATION_SECONDS, createSession, deleteSession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { loginSchema, registerSchema } from "@/lib/schemas/auth-schema";
import { loginUser, registerUser } from "@/lib/services/auth-service";

export type AuthFieldErrors = {
	firstName?: string[];
	lastName?: string[];
	email?: string[];
	password?: string[];
	confirmPassword?: string[];
	form?: string[];
};

export type AuthFormState = {
	errors?: AuthFieldErrors;
	values?: {
		firstName?: string;
		lastName?: string;
		email?: string;
	};
};

type Issue = {
	path: PropertyKey[];
	message: string;
};

export async function registerAction(
	_prevState: AuthFormState,
	formData: FormData,
): Promise<AuthFormState> {
	const raw = {
		firstName: readField(formData, "firstName"),
		lastName: readField(formData, "lastName"),
		email: readField(formData, "email"),
		password: readField(formData, "password"),
		confirmPassword: readField(formData, "confirmPassword"),
	};

	const values = {
		firstName: raw.firstName.trim(),
		lastName: raw.lastName.trim(),
		email: raw.email.trim(),
	};

	const parsed = registerSchema.safeParse(raw);
	if (!parsed.success) {
		return { errors: toFieldErrors(parsed.error.issues), values };
	}

	const result = await registerUser({
		firstName: parsed.data.firstName,
		lastName: parsed.data.lastName,
		email: parsed.data.email,
		password: parsed.data.password,
	});

	if (!result.ok) {
		return { errors: { email: [DUPLICATE_EMAIL_MESSAGE] }, values };
	}

	await startSession(result.user.id);

	// Outside any try/catch: redirect() signals by throwing, and a catch would swallow it.
	redirect("/dashboard");
}

export async function loginAction(
	_prevState: AuthFormState,
	formData: FormData,
): Promise<AuthFormState> {
	const raw = {
		email: readField(formData, "email"),
		password: readField(formData, "password"),
	};

	const values = { email: raw.email.trim() };

	const parsed = loginSchema.safeParse(raw);
	if (!parsed.success) {
		return { errors: toFieldErrors(parsed.error.issues), values };
	}

	const result = await loginUser({
		email: parsed.data.email,
		password: parsed.data.password,
	});

	if (!result.ok) {
		// Form-level, never field-level: attaching this to the email field would hint
		// that the address is registered.
		return { errors: { form: [INVALID_CREDENTIALS_MESSAGE] }, values };
	}

	await startSession(result.user.id);

	redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
	const cookieStore = await cookies();
	const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

	// Delete the row before clearing the cookie. The reverse order risks leaving a live
	// session the user can no longer reach but an attacker with the cookie value still can.
	if (sessionId) {
		await deleteSession(sessionId);
	}

	cookieStore.delete({ name: SESSION_COOKIE_NAME, path: "/" });

	redirect("/login");
}

async function startSession(userId: string): Promise<void> {
	const session = await createSession(userId);
	const cookieStore = await cookies();

	cookieStore.set(SESSION_COOKIE_NAME, session.id, {
		httpOnly: true,
		// A `secure` cookie is silently dropped over plain http://localhost.
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_DURATION_SECONDS,
	});
}

function readField(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === "string" ? value : "";
}

function toFieldErrors(issues: Issue[]): AuthFieldErrors {
	const grouped: Record<string, string[]> = {};

	for (const issue of issues) {
		const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
		grouped[key] = [...(grouped[key] ?? []), issue.message];
	}

	return grouped;
}
