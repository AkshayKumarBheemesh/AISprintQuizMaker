import { execute, queryOne } from "@/lib/d1-client";

import { toBase64Url } from "./base64url";
import { nowSeconds } from "./time";
import type { AuthUser } from "./types";

export const SESSION_DURATION_SECONDS = 604_800;

const SESSION_ID_BYTES = 32;

export type CreatedSession = {
	id: string;
	expiresAt: number;
};

type SessionUserRow = {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	expires_at: number;
};

export async function createSession(userId: string): Promise<CreatedSession> {
	const id = generateSessionId();
	const createdAt = nowSeconds();
	const expiresAt = createdAt + SESSION_DURATION_SECONDS;

	await execute(
		"INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)",
		[id, userId, expiresAt, createdAt],
	);

	return { id, expiresAt };
}

export async function getSessionUser(sessionId: string): Promise<AuthUser | null> {
	if (sessionId.trim().length === 0) {
		return null;
	}

	const row = await queryOne<SessionUserRow>(
		"SELECT u.id AS id, u.first_name AS first_name, u.last_name AS last_name, u.email AS email, s.expires_at AS expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?1",
		[sessionId],
	);

	if (!row) {
		return null;
	}

	if (row.expires_at <= nowSeconds()) {
		await deleteSession(sessionId);
		return null;
	}

	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		email: row.email,
	};
}

export async function deleteSession(sessionId: string): Promise<void> {
	await execute("DELETE FROM sessions WHERE id = ?1", [sessionId]);
}

function generateSessionId(): string {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTES)));
}
