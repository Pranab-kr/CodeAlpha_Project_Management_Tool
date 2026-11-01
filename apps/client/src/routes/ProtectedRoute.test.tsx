import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock("../features/auth/useAuth", () => ({
  useAuth: useAuthMock,
}));

const renderRoutes = () =>
  render(
    <MemoryRouter initialEntries={["/projects"]}>
      <Routes>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/projects" element={<div>Projects screen</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const authValue = (overrides: Record<string, unknown>) => ({
  user: null,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  ...overrides,
});

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to the login screen", () => {
    useAuthMock.mockReturnValue(authValue({ user: null }));
    renderRoutes();
    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });

  it("renders the protected content for authenticated users", () => {
    useAuthMock.mockReturnValue(
      authValue({ user: { id: "u1", email: "maya@codealpha.dev" } }),
    );
    renderRoutes();
    expect(screen.getByText("Projects screen")).toBeInTheDocument();
  });

  it("shows a loading state while auth bootstraps", () => {
    useAuthMock.mockReturnValue(authValue({ isLoading: true }));
    renderRoutes();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Login screen")).toBeNull();
  });
});
