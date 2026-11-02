import type {
  ProjectDetail,
  TaskCard as TaskCardDTO,
  TaskDetail,
} from "@teamboard/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import BoardPage from "./BoardPage";
import { renderWithProviders } from "../../test/render";

const { useAuthMock, projectState, tasksState, taskState } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  projectState: { current: null as ProjectDetail | null },
  tasksState: { current: [] as TaskCardDTO[] },
  taskState: { current: null as TaskDetail | null },
}));

vi.mock("../projects/useProjects", () => ({
  useProject: () => ({
    data: projectState.current,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../tasks/useTasks", () => ({
  useTasks: () => ({
    data: tasksState.current,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useTask: () => ({
    data: taskState.current,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMoveTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateColumn: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateColumn: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReorderColumns: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteColumn: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../features/auth/useAuth", () => ({
  useAuth: useAuthMock,
}));

const maya = {
  id: "u-maya",
  email: "maya@teamboard.dev",
  name: "Maya Chen",
  initials: "MC",
  createdAt: "2026-11-01T10:00:00.000Z",
};

const project: ProjectDetail = {
  id: "p1",
  name: "Website Redesign",
  description: "Refresh the site",
  ownerId: maya.id,
  role: "owner",
  memberCount: 1,
  taskCount: 1,
  columns: [
    {
      id: "col-1",
      projectId: "p1",
      name: "Backlog",
      position: 1024,
      createdAt: "2026-11-01T10:00:00.000Z",
    },
    {
      id: "col-2",
      projectId: "p1",
      name: "In Progress",
      position: 2048,
      createdAt: "2026-11-01T10:00:00.000Z",
    },
    {
      id: "col-3",
      projectId: "p1",
      name: "Done",
      position: 3072,
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
  ],
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

const card: TaskCardDTO = {
  id: "task-1",
  projectId: "p1",
  columnId: "col-1",
  title: "Detail task",
  priority: "medium",
  dueDate: null,
  position: 1024,
  assignee: null,
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

const detail: TaskDetail = {
  ...card,
  description: "The description",
  priority: "high",
};

function renderBoard(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId" element={<BoardPage />} />
    </Routes>,
    { route },
  );
}

describe("BoardPage", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({ user: maya, isLoading: false });
    projectState.current = project;
    tasksState.current = [card];
    taskState.current = detail;
  });

  it("opens the drawer from a deep link", async () => {
    renderBoard("/projects/p1?task=task-1");
    expect(await screen.findByDisplayValue("Detail task")).toBeInTheDocument();
  });

  it("renders the columns and hides the drawer without a task param", () => {
    renderBoard("/projects/p1");
    expect(
      screen.getByRole("heading", { name: "Backlog" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "In Progress" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the drawer when a card is clicked", async () => {
    const user = userEvent.setup();
    renderBoard("/projects/p1");

    await user.click(screen.getByText("Detail task"));
    expect(await screen.findByDisplayValue("Detail task")).toBeInTheDocument();
  });

  it("opens a create drawer from a column add button", async () => {
    const user = userEvent.setup();
    renderBoard("/projects/p1");

    await user.click(screen.getAllByRole("button", { name: "Add task" })[1]);
    expect(await screen.findByText("New task")).toBeInTheDocument();
    expect(screen.getByText("Adding to Backlog.")).toBeInTheDocument();
  });
});
