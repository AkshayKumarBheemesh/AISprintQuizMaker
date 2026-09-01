import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/d1-client", () => ({
	queryAll: vi.fn(),
	queryOne: vi.fn(),
	execute: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
	SESSION_DURATION_SECONDS: 604_800,
	createSession: vi.fn(),
	deleteSession: vi.fn(),
	getSessionUser: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
	getCurrentUser: vi.fn(),
}));

import { getSessionUser } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { execute, queryAll, queryOne } from "@/lib/d1-client";
import { getCurrentUser } from "@/lib/session";

import { config, middleware } from "./middleware";

const SESSION_VALUE = "opaque-session-value-abc123";

function requestFor(pathname: string, cookieValue?: string) {
	const request = new NextRequest(new URL(pathname, "https://quizmaker.test"));
	if (cookieValue !== undefined) {
		request.cookies.set(SESSION_COOKIE_NAME, cookieValue);
	}
	return request;
}

function redirectPath(response: Response): string | null {
	const location = response.headers.get("location");
	return location === null ? null : new URL(location).pathname;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("middleware config", () => {
	it("uses exactly the four required matcher entries, in order", () => {
		expect(config.matcher).toEqual([
			"/dashboard",
			"/dashboard/:path*",
			"/login",
			"/register",
		]);
	});
});

describe("middleware on /dashboard", () => {
	it("redirects to /login when there is no session cookie", () => {
		expect(redirectPath(middleware(requestFor("/dashboard")))).toBe("/login");
	});

	it("redirects a nested dashboard route to /login when there is no cookie", () => {
		expect(redirectPath(middleware(requestFor("/dashboard/settings")))).toBe("/login");
	});

	it("treats an empty cookie value as no cookie", () => {
		expect(redirectPath(middleware(requestFor("/dashboard", "")))).toBe("/login");
	});

	it("lets the request through when a session cookie is present", () => {
		expect(redirectPath(middleware(requestFor("/dashboard", SESSION_VALUE)))).toBeNull();
	});

	it("lets a nested dashboard route through when a cookie is present", () => {
		expect(
			redirectPath(middleware(requestFor("/dashboard/settings", SESSION_VALUE))),
		).toBeNull();
	});

	it("lets a forged cookie through, leaving rejection to getCurrentUser", () => {
		expect(redirectPath(middleware(requestFor("/dashboard", "not-a-real-session")))).toBeNull();
	});
});

describe("middleware on auth routes", () => {
	it.each(["/login", "/register"])(
		"redirects %s to /dashboard when a session cookie is present",
		(pathname) => {
			expect(redirectPath(middleware(requestFor(pathname, SESSION_VALUE)))).toBe(
				"/dashboard",
			);
		},
	);

	it.each(["/login", "/register"])("lets %s through when there is no cookie", (pathname) => {
		expect(redirectPath(middleware(requestFor(pathname)))).toBeNull();
	});

	it.each(["/login", "/register"])(
		"treats an empty cookie on %s as signed out",
		(pathname) => {
			expect(redirectPath(middleware(requestFor(pathname, "")))).toBeNull();
		},
	);
});

describe("middleware boundaries", () => {
	it("never queries D1", () => {
		middleware(requestFor("/dashboard", SESSION_VALUE));
		middleware(requestFor("/dashboard"));
		middleware(requestFor("/login", SESSION_VALUE));
		middleware(requestFor("/register"));

		expect(queryAll).not.toHaveBeenCalled();
		expect(queryOne).not.toHaveBeenCalled();
		expect(execute).not.toHaveBeenCalled();
	});

	it("never validates the session", () => {
		middleware(requestFor("/dashboard", SESSION_VALUE));
		middleware(requestFor("/login", SESSION_VALUE));

		expect(getSessionUser).not.toHaveBeenCalled();
		expect(getCurrentUser).not.toHaveBeenCalled();
	});

	it("reads the cookie through the shared SESSION_COOKIE_NAME constant", () => {
		const request = requestFor("/dashboard", SESSION_VALUE);
		const spy = vi.spyOn(request.cookies, "get");

		middleware(request);

		expect(spy).toHaveBeenCalledWith("quizmaker_session");
	});

	it("never leaks the session value into the redirect location", () => {
		const response = middleware(requestFor("/login", SESSION_VALUE));

		expect(response.headers.get("location")).not.toContain(SESSION_VALUE);
	});

	it("never logs the session value", () => {
		const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
			vi.spyOn(console, method).mockImplementation(() => {}),
		);

		middleware(requestFor("/dashboard", SESSION_VALUE));
		middleware(requestFor("/login", SESSION_VALUE));
		middleware(requestFor("/dashboard"));

		for (const spy of spies) {
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
		}
	});

	it("returns synchronously, adding no awaited work to matched requests", () => {
		expect(middleware(requestFor("/dashboard", SESSION_VALUE))).not.toBeInstanceOf(Promise);
	});
});
