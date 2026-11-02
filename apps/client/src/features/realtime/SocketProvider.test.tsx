import type { Notification, UserDTO } from "@teamboard/shared";
import { act, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../lib/query-keys";
import { createTestQueryClient, renderWithProviders } from "../../test/render";
import { SocketProvider } from "./SocketProvider";

const {
  fakeSocket,
  fire,
  listeners,
  useAuthMock,
  refreshMock,
  logoutMock,
  toastFn,
  toastError,
} = vi.hoisted(() => {
  const eventListeners = new Map<string, Set<(payload: unknown) => void>>();
  const socket = {
    connected: false,
    connect: vi.fn(() => {
      socket.connected = true;
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
    }),
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      const set = eventListeners.get(event) ?? new Set();
      set.add(handler);
      eventListeners.set(event, set);
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      eventListeners.get(event)?.delete(handler);
    }),
    emit: vi.fn(),
  };
  const fire = (event: string, payload?: unknown) => {
    for (const handler of [...(eventListeners.get(event) ?? [])]) {
      handler(payload);
    }
  };
  const toast = vi.fn();
  return {
    fakeSocket: socket,
    fire,
    listeners: eventListeners,
    useAuthMock: vi.fn(),
    refreshMock: vi.fn(),
    logoutMock: vi.fn(),
    toastFn: toast,
    toastError: vi.fn(),
  };
});

vi.mock("../../lib/socket", () => ({
  appSocket: fakeSocket,
  createAppSocket: () => fakeSocket,
}));
vi.mock("../../lib/api", () => ({ refreshSession: refreshMock }));
vi.mock("../auth/useAuth", () => ({ useAuth: useAuthMock }));
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { error: toastError }),
}));

const user: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "maya@teamboard.dev",
  name: "Maya Chen",
  initials: "MC",
  createdAt: "2026-11-01T10:00:00.000Z",
};

const projectId = "33333333-3333-4333-8333-333333333333";

function makeNotification(): Notification {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    type: "task_assigned",
    readAt: null,
    createdAt: "2026-11-02T10:00:00.000Z",
    actor: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials,
    },
    project: { id: projectId, name: "Website Redesign" },
    task: {
      id: "44444444-4444-4444-8444-444444444444",
      title: "Build the new design tokens",
    },
    commentExcerpt: null,
  };
}

function unauthorizedError() {
  return Object.assign(new Error("UNAUTHORIZED"), {
    data: { code: "UNAUTHORIZED" },
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderProvider(route = "/projects") {
  const queryClient = createTestQueryClient();
  const result = renderWithProviders(
    <SocketProvider>
      <LocationProbe />
      <div>child</div>
    </SocketProvider>,
    { route, queryClient },
  );
  return { ...result, queryClient };
}

beforeEach(() => {
  listeners.clear();
  fakeSocket.connected = false;
  fakeSocket.connect.mockClear();
  fakeSocket.disconnect.mockClear();
  fakeSocket.on.mockClear();
  fakeSocket.off.mockClear();
  useAuthMock.mockReset();
  refreshMock.mockReset();
  logoutMock.mockReset();
  toastFn.mockReset();
  toastError.mockReset();
  useAuthMock.mockReturnValue({ user, logout: logoutMock, isLoading: false });
  refreshMock.mockResolvedValue(user);
  logoutMock.mockResolvedValue(undefined);
});

describe("SocketProvider", () => {
  it("connects while authenticated and disconnects on unmount", () => {
    const { unmount } = renderProvider();

    expect(fakeSocket.connect).toHaveBeenCalledTimes(1);
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it("refreshes once and reconnects after an UNAUTHORIZED handshake", async () => {
    renderProvider();

    await act(async () => {
      fire("connect_error", unauthorizedError());
    });

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fakeSocket.connect).toHaveBeenCalledTimes(2));
  });

  it("logs out after a second consecutive UNAUTHORIZED error", async () => {
    renderProvider();

    await act(async () => {
      fire("connect_error", unauthorizedError());
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      fire("connect_error", unauthorizedError());
    });

    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      "Your session expired. Please sign in again.",
    );
  });

  it("logs out when the refresh fails", async () => {
    refreshMock.mockRejectedValue(new Error("refresh failed"));
    renderProvider();

    await act(async () => {
      fire("connect_error", unauthorizedError());
    });

    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      "Your session expired. Please sign in again.",
    );
  });

  it("warns once when live updates are unavailable", async () => {
    renderProvider();

    await act(async () => {
      fire("connect_error", new Error("network down"));
      fire("connect_error", new Error("network down"));
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Live updates are unavailable");
  });

  it("increments the unread badge and toasts on notification:new", async () => {
    const { queryClient } = renderProvider();
    queryClient.setQueryData(queryKeys.notificationUnreadCount, { count: 2 });

    act(() => {
      fire("notification:new", { notification: makeNotification() });
    });

    await waitFor(() =>
      expect(
        queryClient.getQueryData(queryKeys.notificationUnreadCount),
      ).toEqual({ count: 3 }),
    );
    expect(toastFn).toHaveBeenCalledWith(
      expect.stringContaining("Maya Chen assigned you"),
    );
  });

  it("clears the unread badge on notifications:read-all", async () => {
    const { queryClient } = renderProvider();
    queryClient.setQueryData(queryKeys.notificationUnreadCount, { count: 5 });

    act(() => {
      fire("notifications:read-all", {
        readAt: "2026-11-02T10:00:00.000Z",
      });
    });

    expect(queryClient.getQueryData(queryKeys.notificationUnreadCount)).toEqual(
      { count: 0 },
    );
  });

  it("navigates away and toasts when the open project is deleted", async () => {
    renderProvider(`/projects/${projectId}`);

    act(() => {
      fire("project:deleted", { projectId });
    });

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/projects"),
    );
    expect(toastFn).toHaveBeenCalledWith("This project is no longer available");
  });

  it("navigates away when the current user is removed from the project", async () => {
    renderProvider(`/projects/${projectId}`);

    act(() => {
      fire("member:removed", { projectId, userId: user.id });
    });

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/projects"),
    );
    expect(toastFn).toHaveBeenCalledWith("This project is no longer available");
  });

  it("keeps the current route when another member is removed", async () => {
    renderProvider(`/projects/${projectId}`);

    act(() => {
      fire("member:removed", { projectId, userId: "another-user" });
    });

    expect(screen.getByTestId("location")).toHaveTextContent(
      `/projects/${projectId}`,
    );
    expect(toastFn).not.toHaveBeenCalled();
  });

  it("reconciles caches on every connect", async () => {
    const { queryClient } = renderProvider();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      fire("connect");
    });

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: queryKeys.notifications,
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.projects });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tasks"] });
  });
});
