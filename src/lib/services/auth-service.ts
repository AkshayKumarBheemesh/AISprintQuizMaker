import { normalizeEmail } from "@/lib/auth/email";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { AuthUser } from "@/lib/auth/types";
import { execute, queryOne } from "@/lib/d1-client";

export type RegisterInput = {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
};

export type LoginInput = {
	email: string;
	password: string;
};

export type RegisterResult =
	| { ok: true; user: AuthUser }
	| { ok: false; error: "DUPLICATE_EMAIL" };

export type LoginResult =
	| { ok: true; user: AuthUser }
	| { ok: false; error: "INVALID_CREDENTIALS" };

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	password_hash: string;
};

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
	const email = normalizeEmail(input.email);
	const firstName = input.firstName.trim();
	const lastName = input.lastName.trim();
	const passwordHash = await hashPassword(input.password);
	const id = crypto.randomUUID();

	try {
		await execute(
			"INSERT INTO users (id, first_name, last_name, email, password_hash) VALUES (?1, ?2, ?3, ?4, ?5)",
			[id, firstName, lastName, email, passwordHash],
		);
	} catch (error) {
		// The unique index is the only real guarantee. Checking for an existing row first
		// would leave a window in which two concurrent registrations both succeed.
		if (isDuplicateEmailError(error)) {
			return { ok: false, error: "DUPLICATE_EMAIL" };
		}
		throw error;
	}

	return { ok: true, user: { id, firstName, lastName, email } };
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
	const email = normalizeEmail(input.email);

	const row = await queryOne<UserRow>(
		"SELECT id, first_name, last_name, email, password_hash FROM users WHERE email = ?1",
		[email],
	);

	if (!row) {
		// Derive anyway, so an unknown email costs roughly what a wrong password costs
		// and the response time does not reveal which addresses are registered.
		await hashPassword(input.password);
		return { ok: false, error: "INVALID_CREDENTIALS" };
	}

	if (!(await verifyPassword(input.password, row.password_hash))) {
		return { ok: false, error: "INVALID_CREDENTIALS" };
	}

	return {
		ok: true,
		user: {
			id: row.id,
			firstName: row.first_name,
			lastName: row.last_name,
			email: row.email,
		},
	};
}

function isDuplicateEmailError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message;
	// Local unique index is ON users(email). Remote leftover schema is
	// ON users(lower(email)), which SQLite reports as the index name.
	return (
		message.includes("UNIQUE constraint failed: users.email") ||
		message.includes("UNIQUE constraint failed: index 'idx_users_email'")
	);
}
