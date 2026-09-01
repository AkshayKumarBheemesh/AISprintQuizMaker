import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/auth/clear-session", () => {
	it("redirects to /login", async () => {
		const response = await GET(
			new Request("http://127.0.0.1:8787/api/auth/clear-session"),
		);

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("http://127.0.0.1:8787/login");
	});

	it("expires the quizmaker_session cookie on the redirect", async () => {
		const response = await GET(
			new Request("http://127.0.0.1:8787/api/auth/clear-session"),
		);

		const setCookie = response.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("quizmaker_session=");
		expect(setCookie).toMatch(/Max-Age=0|Expires=/i);
		expect(setCookie).toContain("Path=/");
	});
});
