/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/auth-actions", () => ({
	registerAction: vi.fn(),
	loginAction: vi.fn(),
	logoutAction: vi.fn(),
}));

import { logoutAction } from "@/lib/actions/auth-actions";

import { LogoutButton } from "./logout-button";

const mockLogoutAction = vi.mocked(logoutAction);

beforeEach(() => {
	vi.clearAllMocks();
	mockLogoutAction.mockResolvedValue(undefined);
});

describe("LogoutButton", () => {
	it("renders a logout control", () => {
		render(<LogoutButton />);

		expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
	});

	it("calls logoutAction when clicked", async () => {
		const user = userEvent.setup();
		render(<LogoutButton />);

		await user.click(screen.getByRole("button", { name: /log out/i }));

		expect(await vi.waitFor(() => mockLogoutAction.mock.calls.length)).toBeGreaterThan(0);
	});
});
