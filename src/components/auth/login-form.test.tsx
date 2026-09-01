/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/auth-actions", () => ({
	registerAction: vi.fn(),
	loginAction: vi.fn(),
	logoutAction: vi.fn(),
}));

import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/errors";
import { loginAction } from "@/lib/actions/auth-actions";

import { LoginForm } from "./login-form";

const mockLoginAction = vi.mocked(loginAction);

beforeEach(() => {
	vi.clearAllMocks();
	mockLoginAction.mockResolvedValue({});
});

describe("LoginForm", () => {
	it("C-7: submitting an empty form shows required-field errors and does not call the action", async () => {
		const user = userEvent.setup();
		render(<LoginForm />);

		await user.click(screen.getByRole("button", { name: /sign in/i }));

		expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
		expect(screen.getByText("Password is required.")).toBeInTheDocument();
		expect(mockLoginAction).not.toHaveBeenCalled();
	});

	it("C-8: renders a server-returned generic authentication error", () => {
		render(
			<LoginForm
				initialState={{
					errors: { form: [INVALID_CREDENTIALS_MESSAGE] },
					values: { email: "ada@school.org" },
				}}
			/>,
		);

		expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument();
	});

	it("does not attach the generic error to the email field", () => {
		render(
			<LoginForm
				initialState={{
					errors: { form: [INVALID_CREDENTIALS_MESSAGE] },
					values: { email: "ada@school.org" },
				}}
			/>,
		);

		expect(screen.getByLabelText("Email")).not.toHaveAccessibleErrorMessage();
	});

	it("C-5: a valid submission invokes the login action", async () => {
		const user = userEvent.setup();
		render(<LoginForm />);

		await user.type(screen.getByLabelText("Email"), "ada@school.org");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.click(screen.getByRole("button", { name: /sign in/i }));

		expect(await vi.waitFor(() => mockLoginAction.mock.calls.length)).toBeGreaterThan(0);
	});

	it("C-9: the password input is type=password", () => {
		render(<LoginForm />);

		expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
	});
});
