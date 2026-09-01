import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore } = vi.hoisted(() => ({
	cookieStore: {
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => cookieStore),
}));

vi.mock("next/navigation", () => ({
	redirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	}),
}));

vi.mock("@/lib/auth/session", () => ({
	SESSION_DURATION_SECONDS: 604_800,
	createSession: vi.fn(),
	deleteSession: vi.fn(),
}));

vi.mock("@/lib/services/auth-service", () => ({
	registerUser: vi.fn(),
	loginUser: vi.fn(),
}));

import { createSession, deleteSession } from "@/lib/auth/session";
import {
	DUPLICATE_EMAIL_MESSAGE,
	INVALID_CREDENTIALS_MESSAGE,
} from "@/lib/auth/errors";
import { loginUser, registerUser } from "@/lib/services/auth-service";
import { redirect } from "next/navigation";

import { loginAction, logoutAction, registerAction } from "./auth-actions";

const mockRedirect = vi.mocked(redirect);
const mockCreateSession = vi.mocked(createSession);
const mockDeleteSession = vi.mocked(deleteSession);
const mockRegisterUser = vi.mocked(registerUser);
const mockLoginUser = vi.mocked(loginUser);

const AUTH_USER = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.org",
};

const PASSWORD = "password123";

function registerForm(overrides: Record<string, string> = {}) {
	const fields: Record<string, string> = {
		firstName: "Ada",
		lastName: "Lovelace",
		email: "ada@school.org",
		password: PASSWORD,
		confirmPassword: PASSWORD,
		...overrides,
	};

	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.set(key, value);
	}
	return formData;
}

function loginForm(overrides: Record<string, string> = {}) {
	const fields: Record<string, string> = {
		email: "ada@school.org",
		password: PASSWORD,
		...overrides,
	};

	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.set(key, value);
	}
	return formData;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockCreateSession.mockResolvedValue({ id: "session-abc", expiresAt: 1_756_700_000 });
	mockDeleteSession.mockResolvedValue(undefined);
	mockRegisterUser.mockResolvedValue({ ok: true, user: AUTH_USER });
	mockLoginUser.mockResolvedValue({ ok: true, user: AUTH_USER });
});

describe("registerAction", () => {
	it("A-1: returns field errors for a missing first name and does not create a user", async () => {
		const state = await registerAction({}, registerForm({ firstName: "" }));

		expect(state.errors?.firstName?.length).toBeGreaterThan(0);
		expect(mockRegisterUser).not.toHaveBeenCalled();
	});

	it("A-2: returns a field error for a malformed email", async () => {
		const state = await registerAction({}, registerForm({ email: "not-an-email" }));

		expect(state.errors?.email?.length).toBeGreaterThan(0);
		expect(mockRegisterUser).not.toHaveBeenCalled();
	});

	it("A-3: returns a field error for a password under 8 characters", async () => {
		const state = await registerAction(
			{},
			registerForm({ password: "short", confirmPassword: "short" }),
		);

		expect(state.errors?.password?.length).toBeGreaterThan(0);
		expect(mockRegisterUser).not.toHaveBeenCalled();
	});

	it("A-4: returns a field error when the passwords do not match", async () => {
		const state = await registerAction({}, registerForm({ confirmPassword: "different" }));

		expect(state.errors?.confirmPassword).toContain("Passwords do not match.");
		expect(mockRegisterUser).not.toHaveBeenCalled();
	});

	it("A-5: returns the exact duplicate-email message on the email field", async () => {
		mockRegisterUser.mockResolvedValue({ ok: false, error: "DUPLICATE_EMAIL" });

		const state = await registerAction({}, registerForm());

		expect(state.errors?.email).toEqual([DUPLICATE_EMAIL_MESSAGE]);
		expect(state.errors?.email).toEqual(["An account with this email already exists."]);
	});

	it("A-5: does not create a session when registration is rejected", async () => {
		mockRegisterUser.mockResolvedValue({ ok: false, error: "DUPLICATE_EMAIL" });

		await registerAction({}, registerForm());

		expect(mockCreateSession).not.toHaveBeenCalled();
		expect(cookieStore.set).not.toHaveBeenCalled();
	});

	it("A-6: creates the user with normalized input", async () => {
		await expect(
			registerAction({}, registerForm({ email: "  Ada@School.ORG  ", firstName: " Ada " })),
		).rejects.toThrow("NEXT_REDIRECT");

		expect(mockRegisterUser).toHaveBeenCalledWith({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.org",
			password: PASSWORD,
		});
	});

	it("A-6: creates a session for the new user", async () => {
		await expect(registerAction({}, registerForm())).rejects.toThrow("NEXT_REDIRECT");

		expect(mockCreateSession).toHaveBeenCalledWith("user-1");
	});

	it("A-7: redirects to /dashboard on success", async () => {
		await expect(registerAction({}, registerForm())).rejects.toThrow(
			"NEXT_REDIRECT:/dashboard",
		);

		expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
	});

	it("A-16: sets the session cookie httpOnly with a 7-day maxAge", async () => {
		await expect(registerAction({}, registerForm())).rejects.toThrow("NEXT_REDIRECT");

		expect(cookieStore.set).toHaveBeenCalledTimes(1);
		const [name, value, options] = cookieStore.set.mock.calls[0];
		expect(name).toBe("quizmaker_session");
		expect(value).toBe("session-abc");
		expect(options).toMatchObject({
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			maxAge: 604_800,
		});
	});

	it("sets the cookie before redirecting, or the redirect would drop it", async () => {
		const order: string[] = [];
		cookieStore.set.mockImplementation(() => {
			order.push("set-cookie");
		});
		mockRedirect.mockImplementation((url: string) => {
			order.push("redirect");
			throw new Error(`NEXT_REDIRECT:${url}`);
		});

		await expect(registerAction({}, registerForm())).rejects.toThrow("NEXT_REDIRECT");

		expect(order).toEqual(["set-cookie", "redirect"]);
	});

	it("never returns the password or the session id in the action state", async () => {
		mockRegisterUser.mockResolvedValue({ ok: false, error: "DUPLICATE_EMAIL" });

		const state = await registerAction({}, registerForm());

		expect(JSON.stringify(state)).not.toContain(PASSWORD);
		expect(JSON.stringify(state)).not.toContain("session-abc");
	});

	it("echoes back non-secret values so the user does not retype them", async () => {
		const state = await registerAction({}, registerForm({ confirmPassword: "different" }));

		expect(state.values).toMatchObject({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.org",
		});
	});
});

describe("loginAction", () => {
	it("A-8: rejects a malformed email before touching the service", async () => {
		const state = await loginAction({}, loginForm({ email: "nope" }));

		expect(state.errors?.email?.length).toBeGreaterThan(0);
		expect(mockLoginUser).not.toHaveBeenCalled();
	});

	it("A-8: rejects an empty password before touching the service", async () => {
		const state = await loginAction({}, loginForm({ password: "" }));

		expect(state.errors?.password?.length).toBeGreaterThan(0);
		expect(mockLoginUser).not.toHaveBeenCalled();
	});

	it("A-9: returns the generic error for wrong credentials", async () => {
		mockLoginUser.mockResolvedValue({ ok: false, error: "INVALID_CREDENTIALS" });

		const state = await loginAction({}, loginForm());

		expect(state.errors?.form).toEqual([INVALID_CREDENTIALS_MESSAGE]);
		expect(state.errors?.form).toEqual(["Incorrect email or password."]);
	});

	it("A-9: creates no session and sets no cookie on failure", async () => {
		mockLoginUser.mockResolvedValue({ ok: false, error: "INVALID_CREDENTIALS" });

		await loginAction({}, loginForm());

		expect(mockCreateSession).not.toHaveBeenCalled();
		expect(cookieStore.set).not.toHaveBeenCalled();
	});

	it("A-9: does not attach the error to the email field, which would hint the address exists", async () => {
		mockLoginUser.mockResolvedValue({ ok: false, error: "INVALID_CREDENTIALS" });

		const state = await loginAction({}, loginForm());

		expect(state.errors?.email).toBeUndefined();
		expect(state.errors?.password).toBeUndefined();
	});

	it("A-10: creates a session on success", async () => {
		await expect(loginAction({}, loginForm())).rejects.toThrow("NEXT_REDIRECT");

		expect(mockCreateSession).toHaveBeenCalledWith("user-1");
	});

	it("A-11: redirects to /dashboard on success", async () => {
		await expect(loginAction({}, loginForm())).rejects.toThrow("NEXT_REDIRECT:/dashboard");

		expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
	});

	it("A-16: sets the session cookie httpOnly with a 7-day maxAge", async () => {
		await expect(loginAction({}, loginForm())).rejects.toThrow("NEXT_REDIRECT");

		const [name, value, options] = cookieStore.set.mock.calls[0];
		expect(name).toBe("quizmaker_session");
		expect(value).toBe("session-abc");
		expect(options).toMatchObject({ httpOnly: true, maxAge: 604_800 });
	});

	it("normalizes the email before authenticating", async () => {
		await expect(
			loginAction({}, loginForm({ email: "  Ada@School.ORG " })),
		).rejects.toThrow("NEXT_REDIRECT");

		expect(mockLoginUser).toHaveBeenCalledWith({
			email: "ada@school.org",
			password: PASSWORD,
		});
	});

	it("never returns the password in the action state", async () => {
		mockLoginUser.mockResolvedValue({ ok: false, error: "INVALID_CREDENTIALS" });

		const state = await loginAction({}, loginForm());

		expect(JSON.stringify(state)).not.toContain(PASSWORD);
	});
});

describe("logoutAction", () => {
	it("A-12: deletes the D1 session identified by the cookie", async () => {
		cookieStore.get.mockReturnValue({ name: "quizmaker_session", value: "session-abc" });

		await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");

		expect(mockDeleteSession).toHaveBeenCalledWith("session-abc");
	});

	it("A-13: clears the quizmaker_session cookie", async () => {
		cookieStore.get.mockReturnValue({ name: "quizmaker_session", value: "session-abc" });

		await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");

		expect(cookieStore.delete).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(cookieStore.delete.mock.calls[0])).toContain("quizmaker_session");
	});

	it("A-12/A-13: deletes the database row before clearing the cookie", async () => {
		cookieStore.get.mockReturnValue({ name: "quizmaker_session", value: "session-abc" });
		const order: string[] = [];
		mockDeleteSession.mockImplementation(async () => {
			order.push("delete-row");
		});
		cookieStore.delete.mockImplementation(() => {
			order.push("clear-cookie");
		});

		await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");

		expect(order).toEqual(["delete-row", "clear-cookie"]);
	});

	it("A-14: redirects to /login", async () => {
		cookieStore.get.mockReturnValue({ name: "quizmaker_session", value: "session-abc" });

		await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

		expect(mockRedirect).toHaveBeenCalledWith("/login");
	});

	it("A-15: still clears and redirects when no session cookie is present", async () => {
		cookieStore.get.mockReturnValue(undefined);

		await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

		expect(mockDeleteSession).not.toHaveBeenCalled();
		expect(cookieStore.delete).toHaveBeenCalledTimes(1);
	});

	it("A-15: still clears and redirects when the session row is already gone", async () => {
		cookieStore.get.mockReturnValue({ name: "quizmaker_session", value: "already-gone" });
		mockDeleteSession.mockResolvedValue(undefined);

		await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

		expect(cookieStore.delete).toHaveBeenCalledTimes(1);
	});
});
