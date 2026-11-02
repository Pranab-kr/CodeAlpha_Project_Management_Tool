import type { Notification, NotificationList } from "@teamboard/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import NotificationBell from "./NotificationBell";

const { listMock, countMock, markMock, markAllMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  countMock: vi.fn(),
  markMock: vi.fn(),
  markAllMock: vi.fn(),
}));

vi.mock("./notifications.api", () => ({
  listNotifications: listMock,
  getUnreadCount: countMock,
  markNotificationRead: markMock,
  markAllNotificationsRead: markAllMock,
}));

const projectId = "33333333-3333-4333-8333-333333333333";
const taskId = "44444444-4444-4444-8444-444444444444";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    type: "task_assigned",
    readAt: null,
    createdAt: "2026-11-02T10:00:00.000Z",
    actor: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "maya@teamboard.dev",
      name: "Maya Chen",
      initials: "MC",
    },
    project: { id: projectId, name: "Website Redesign" },
    task: { id: taskId, title: "Build the new design tokens" },
    commentExcerpt: null,
    ...overrides,
  };
}

function makeList(
  items: Notification[] = [],
  unreadCount = 0,
): NotificationList {
  return { items, unreadCount, nextCursor: null };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderBell() {
  return renderWithProviders(
    <>
      <NotificationBell />
      <LocationProbe />
    </>,
    { route: "/projects/start" },
  );
}

async function openBell(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Notifications" }));
}

beforeEach(() => {
  listMock.mockReset();
  countMock.mockReset();
  markMock.mockReset();
  markAllMock.mockReset();
  countMock.mockResolvedValue({ count: 0 });
  listMock.mockResolvedValue(makeList());
  markMock.mockResolvedValue({ notification: makeNotification() });
  markAllMock.mockResolvedValue({ updated: 0 });
});

describe("NotificationBell", () => {
  it("renders no badge when there are no unread notifications", async () => {
    renderBell();

    await waitFor(() => expect(countMock).toHaveBeenCalled());
    expect(
      screen.queryByLabelText(/unread notifications/),
    ).not.toBeInTheDocument();
  });

  it("renders 9+ above nine unread notifications", async () => {
    countMock.mockResolvedValue({ count: 12 });
    renderBell();

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  it("shows the ten most recent with unread dots", async () => {
    const items = Array.from({ length: 10 }, (_, index) =>
      makeNotification({
        id: `22222222-2222-4222-8222-22222222222${index}`,
        readAt: index < 4 ? null : "2026-11-02T09:00:00.000Z",
      }),
    );
    countMock.mockResolvedValue({ count: 4 });
    listMock.mockResolvedValue(makeList(items, 4));
    const user = userEvent.setup();
    renderBell();

    await openBell(user);

    const list = await screen.findByRole("list", {
      name: "Notifications list",
    });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getAllByLabelText("Unread notification")).toHaveLength(4);
  });

  it("marks an item read and opens the task drawer route", async () => {
    const notification = makeNotification();
    countMock.mockResolvedValue({ count: 1 });
    listMock.mockResolvedValue(makeList([notification], 1));
    markMock.mockResolvedValue({
      notification: { ...notification, readAt: "2026-11-02T11:00:00.000Z" },
    });
    const user = userEvent.setup();
    renderBell();

    await openBell(user);
    await user.click(
      await screen.findByText(/assigned you Build the new design tokens/i),
    );

    expect(markMock).toHaveBeenCalledWith(notification.id);
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        `/projects/${projectId}?task=${taskId}`,
      ),
    );
  });

  it("marks all read and clears the badge", async () => {
    const first = makeNotification({
      id: "22222222-2222-4222-8222-222222222221",
    });
    const second = makeNotification({
      id: "22222222-2222-4222-8222-222222222222",
    });
    countMock
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValue({ count: 0 });
    listMock.mockResolvedValue(makeList([first, second], 2));
    const user = userEvent.setup();
    renderBell();

    await screen.findByText("2");
    await openBell(user);
    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    await waitFor(() => expect(markAllMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByLabelText(/unread notifications/),
      ).not.toBeInTheDocument(),
    );
  });

  it("renders the empty state", async () => {
    const user = userEvent.setup();
    renderBell();

    await openBell(user);

    expect(
      await screen.findByText("You're all caught up."),
    ).toBeInTheDocument();
  });

  it("shows a retry when the list fails", async () => {
    listMock
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce(makeList());
    const user = userEvent.setup();
    renderBell();

    await openBell(user);

    expect(
      await screen.findByText("Could not load notifications."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("shows skeletons while the list loads", async () => {
    listMock.mockImplementation(() => new Promise(() => undefined));
    const user = userEvent.setup();
    renderBell();

    await openBell(user);

    expect(
      await screen.findByLabelText("Loading notifications"),
    ).toBeInTheDocument();
  });
});
