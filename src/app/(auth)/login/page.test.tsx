/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/auth-actions", () => ({
	loginAction: vi.fn(),
}));

import LoginPage from "./page";

describe("login page", () => {
	it("renders a sign-in heading and the login form", () => {
		render(<LoginPage />);

		expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
		expect(screen.getByLabelText("Email")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute(
			"href",
			"/register",
		);
	});
});
