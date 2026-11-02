import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { renderWithProviders } from "./test/render";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock("./features/auth/useAuth", () => ({ useAuth: useAuthMock }));
vi.mock("./features/realtime/SocketProvider", () => ({
  SocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./features/realtime/useSocket", () => ({
  useSocket: () => ({ socket: { connected: false }, isConnected: false }),
}));
vi.mock("./features/notifications/notifications.api", () => ({
  listNotifications: vi.fn().mockResolvedValue({
    items: [],
    unreadCount: 0,
    nextCursor: null,
  }),
  getUnreadCount: vi.fn().mockResolvedValue({ count: 0 }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock("./features/projects/useProjects", () => ({
  useProjects: () => ({
    data: [],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useProject: () => ({
    data: undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const maya = {
  id: "u1",
  email: "maya@teamboard.dev",
  name: "Maya Chen",
  initials: "MC",
  createdAt: "2026-11-01T00:00:00.000Z",
};

function authValue(user: typeof maya | null) {
  return {
    user,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };
}

beforeEach(() => {
  useAuthMock.mockReset();
});

describe("App routes", () => {
  it("redirects / to /projects when authenticated", async () => {
    useAuthMock.mockReturnValue(authValue(maya));

    renderWithProviders(<App />, { route: "/" });

    expect(
      await screen.findByRole("heading", { name: "Your projects" }),
    ).toBeInTheDocument();
  });

  it("sends signed-out visitors from / to the login screen", async () => {
    useAuthMock.mockReturnValue(authValue(null));

    renderWithProviders(<App />, { route: "/" });

    expect(
      await screen.findByRole("heading", { name: "TeamBoard" }),
    ).toBeInTheDocument();
  });

  it("renders the public not-found page for an unknown route", () => {
    useAuthMock.mockReturnValue(authValue(null));

    renderWithProviders(<App />, { route: "/does-not-exist" });

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
  });
});
