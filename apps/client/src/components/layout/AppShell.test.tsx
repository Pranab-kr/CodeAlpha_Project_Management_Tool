import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";

const { useAuthMock, logoutMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock("../../features/auth/useAuth", () => ({
  useAuth: useAuthMock,
}));

const maya = {
  id: "u1",
  email: "maya@teamboard.dev",
  name: "Maya Chen",
  initials: "MC",
  createdAt: "2026-11-01T00:00:00.000Z",
};

describe("AppShell", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    useAuthMock.mockReturnValue({
      user: maya,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: logoutMock,
    });
  });

  it("shows the product mark, the user initials, and the page content", () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>Board content</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("TeamBoard")).toBeInTheDocument();
    expect(screen.getByText("MC")).toBeInTheDocument();
    expect(screen.getByText("Board content")).toBeInTheDocument();
  });

  it("shows the account email and logs out from the user menu", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppShell>
          <p>Board content</p>
        </AppShell>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /open user menu/i }));
    expect(await screen.findByText("maya@teamboard.dev")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /log out/i }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
