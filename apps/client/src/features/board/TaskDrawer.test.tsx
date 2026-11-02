import type { ProjectDetail, TaskDetail } from "@teamboard/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TaskDrawer from "./TaskDrawer";
import { renderWithProviders } from "../../test/render";

const { useAuthMock, createMock, updateMock, deleteMock, taskState } =
  vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
    deleteMock: vi.fn(),
    taskState: { current: null as TaskDetail | null },
  }));

vi.mock("../../features/auth/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("../tasks/useTasks", () => ({
  useTask: () => ({
    data: taskState.current,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateTask: () => ({ mutateAsync: createMock, isPending: false }),
  useUpdateTask: () => ({ mutateAsync: updateMock, isPending: false }),
  useDeleteTask: () => ({ mutateAsync: deleteMock, isPending: false }),
}));

const maya = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "maya@teamboard.dev",
  name: "Maya Chen",
  initials: "MC",
  createdAt: "2026-11-01T10:00:00.000Z",
};
const dev = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "dev@teamboard.dev",
  name: "Dev Patel",
  initials: "DP",
  createdAt: "2026-11-01T10:00:00.000Z",
};

const project: ProjectDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Website Redesign",
  description: "",
  ownerId: maya.id,
  role: "owner",
  memberCount: 2,
  taskCount: 1,
  columns: [
    {
      id: "col-1",
      projectId: "11111111-1111-4111-8111-111111111111",
      name: "Backlog",
      position: 1024,
      createdAt: "2026-11-01T10:00:00.000Z",
    },
  ],
  members: [
    {
      userId: maya.id,
      email: maya.email,
      name: maya.name,
      initials: maya.initials,
      role: "owner",
      joinedAt: "2026-11-01T10:00:00.000Z",
    },
    {
      userId: dev.id,
      email: dev.email,
      name: dev.name,
      initials: dev.initials,
      role: "member",
      joinedAt: "2026-11-01T10:00:00.000Z",
    },
  ],
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

const task: TaskDetail = {
  id: "task-1",
  projectId: project.id,
  columnId: "col-1",
  title: "Detail task",
  description: "The description",
  priority: "high",
  dueDate: "2026-11-15",
  position: 1024,
  assignee: {
    id: dev.id,
    email: dev.email,
    name: dev.name,
    initials: dev.initials,
  },
  createdBy: {
    id: maya.id,
    email: maya.email,
    name: maya.name,
    initials: maya.initials,
  },
  commentCount: 0,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

function renderDrawer(overrides: {
  taskId: string | null;
  role?: ProjectDetail["role"];
}) {
  const onOpenChange = vi.fn();
  renderWithProviders(
    <TaskDrawer
      project={{ ...project, role: overrides.role ?? "owner" }}
      taskId={overrides.taskId}
      createColumnId="col-1"
      open
      onOpenChange={onOpenChange}
    />,
  );
  return { onOpenChange };
}

describe("TaskDrawer", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    useAuthMock.mockReturnValue({ user: maya, isLoading: false });
    createMock.mockResolvedValue({ task });
    updateMock.mockResolvedValue({ task });
    deleteMock.mockResolvedValue(undefined);
    taskState.current = null;
  });

  it("creates a task from the drawer", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDrawer({ taskId: null });

    await user.type(screen.getByLabelText("Title"), "New task");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    expect(createMock).toHaveBeenCalledWith({
      columnId: "col-1",
      title: "New task",
      description: "",
      priority: "medium",
      dueDate: null,
      assigneeId: null,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("prefills an existing task and saves trimmed values", async () => {
    taskState.current = task;
    const user = userEvent.setup();
    renderDrawer({ taskId: task.id });

    const title = await screen.findByDisplayValue("Detail task");
    expect(screen.getByLabelText("Assignee")).toBeInTheDocument();

    await user.clear(title);
    await user.type(title, "  Renamed task  ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateMock).toHaveBeenCalledWith({
      taskId: task.id,
      input: {
        title: "Renamed task",
        description: "The description",
        priority: "high",
        dueDate: "2026-11-15",
        assigneeId: dev.id,
      },
    });
  });

  it("blocks an empty title", async () => {
    taskState.current = task;
    const user = userEvent.setup();
    renderDrawer({ taskId: task.id });

    const title = await screen.findByDisplayValue("Detail task");
    await user.clear(title);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/too small/i)).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("hides delete from a plain member on another user's task", async () => {
    taskState.current = task;
    useAuthMock.mockReturnValue({ user: dev, isLoading: false });
    renderDrawer({ taskId: task.id, role: "member" });

    await screen.findByDisplayValue("Detail task");
    expect(
      screen.queryByRole("button", { name: "Delete task" }),
    ).not.toBeInTheDocument();
  });

  it("shows delete to the owner and the creator", async () => {
    taskState.current = task;
    renderDrawer({ taskId: task.id });

    await screen.findByDisplayValue("Detail task");
    expect(
      screen.getByRole("button", { name: "Delete task" }),
    ).toBeInTheDocument();
  });
});
