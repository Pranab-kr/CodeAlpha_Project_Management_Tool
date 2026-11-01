import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api";
import LoginPage from "./LoginPage";

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));

vi.mock("../features/auth/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login: loginMock,
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

const renderLogin = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("renders email and password fields with a submit button", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("shows the server message when the credentials are rejected", async () => {
    loginMock.mockRejectedValue(
      new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password"),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "maya@codealpha.dev");
    await user.type(screen.getByLabelText(/password/i), "WrongPassword!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText("Invalid email or password"),
    ).toBeInTheDocument();
  });

  it("fills the seeded credentials from the demo shortcut", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: /use demo account/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveValue("maya@codealpha.dev");
    });
    expect(screen.getByLabelText(/password/i)).toHaveValue("Password123!");
  });
});
