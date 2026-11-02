import type { TaskCard as TaskCardDTO } from "@teamboard/shared";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TaskCard from "./TaskCard";
import { renderWithProviders } from "../../test/render";

function makeTask(overrides: Partial<TaskCardDTO> = {}): TaskCardDTO {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "22222222-2222-4222-8222-222222222222",
    columnId: "33333333-3333-4333-8333-333333333333",
    title: "Fix refresh rotation",
    priority: "high",
    dueDate: "2099-11-15",
    position: 1024,
    assignee: {
      id: "u-dev",
      email: "dev@teamboard.dev",
      name: "Dev Patel",
      initials: "DP",
    },
    createdBy: {
      id: "u-maya",
      email: "maya@teamboard.dev",
      name: "Maya Chen",
      initials: "MC",
    },
    commentCount: 2,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    ...overrides,
  };
}

describe("TaskCard", () => {
  it("renders title, priority, due date, assignee initials, and comments", () => {
    renderWithProviders(<TaskCard task={makeTask()} />);

    expect(screen.getByText("Fix refresh rotation")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Nov 15")).toBeInTheDocument();
    expect(screen.getByText("DP")).toBeInTheDocument();
    expect(screen.getByLabelText("2 comments")).toHaveTextContent("2");
  });

  it("marks an overdue date and shows unassigned cards", () => {
    renderWithProviders(
      <TaskCard task={makeTask({ dueDate: "2020-01-01", assignee: null })} />,
    );

    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    const overdue = screen.getByText(/Overdue/);
    expect(overdue).toHaveTextContent("Jan 1");
    expect(overdue.className).toContain("text-destructive");
  });

  it("omits the due date when none is set", () => {
    renderWithProviders(<TaskCard task={makeTask({ dueDate: null })} />);
    expect(screen.queryByText(/Nov 15/)).not.toBeInTheDocument();
  });
});
