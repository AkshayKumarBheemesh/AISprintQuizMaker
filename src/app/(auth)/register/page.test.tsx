/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/auth-actions", () => ({
	registerAction: vi.fn(),
}));

import RegisterPage from "./page";

describe("register page", () => {
	it("renders a registration heading and the register form", () => {
		render(<RegisterPage />);

		expect(screen.getByRole("heading", { name: /create an account/i })).toBeInTheDocument();
		expect(screen.getByLabelText("First name")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
	});
});
