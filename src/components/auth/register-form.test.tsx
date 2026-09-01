/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/auth-actions", () => ({
	registerAction: vi.fn(),
	loginAction: vi.fn(),
	logoutAction: vi.fn(),
}));

import { registerAction } from "@/lib/actions/auth-actions";

import { RegisterForm } from "./register-form";

const mockRegisterAction = vi.mocked(registerAction);

beforeEach(() => {
	vi.clearAllMocks();
	mockRegisterAction.mockResolvedValue({});
});

describe("RegisterForm", () => {
	it("C-1: submitting an empty form shows required-field errors and does not call the action", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);

		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByText("First name is required.")).toBeInTheDocument();
		expect(screen.getByText("Last name is required.")).toBeInTheDocument();
		expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
		expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
		expect(mockRegisterAction).not.toHaveBeenCalled();
	});

	it("C-2: an invalid email shows an email-format error", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);

		await user.type(screen.getByLabelText("Email"), "not-an-email");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
		expect(mockRegisterAction).not.toHaveBeenCalled();
	});

	it("C-3: a password under 8 characters shows a length error", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);

		await user.type(screen.getByLabelText("Password"), "short");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByText("Password must be at least 8 characters.")).toBeInTheDocument();
		expect(mockRegisterAction).not.toHaveBeenCalled();
	});

	it("C-4: mismatched passwords show a mismatch error on the confirm field", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);

		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password124");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
		expect(mockRegisterAction).not.toHaveBeenCalled();
	});

	it("C-5: a valid submission invokes the action without client-side errors", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);

		await user.type(screen.getByLabelText("First name"), "Ada");
		await user.type(screen.getByLabelText("Last name"), "Lovelace");
		await user.type(screen.getByLabelText("Email"), "ada@school.org");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await vi.waitFor(() => mockRegisterAction.mock.calls.length)).toBeGreaterThan(0);
		expect(screen.queryByText("First name is required.")).not.toBeInTheDocument();
		expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
	});

	it("C-6: validation errors are associated with their fields", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);

		await user.click(screen.getByRole("button", { name: /create account/i }));

		const email = await screen.findByLabelText("Email");
		expect(email).toHaveAccessibleErrorMessage(/valid email/i);
	});

	it("C-9: password inputs are type=password", () => {
		render(<RegisterForm />);

		expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
		expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "password");
	});

	it("renders a server-returned duplicate-email error on the email field", () => {
		render(
			<RegisterForm
				initialState={{
					errors: { email: ["An account with this email already exists."] },
					values: { email: "ada@school.org" },
				}}
			/>,
		);

		expect(screen.getByText("An account with this email already exists.")).toBeInTheDocument();
	});
});
