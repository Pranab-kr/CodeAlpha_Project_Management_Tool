import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import EmptyState from "./states/EmptyState";
import ErrorState from "./states/ErrorState";
import PageSkeleton from "./states/PageSkeleton";
import {
  ProjectForbidden,
  ProjectNotFound,
} from "../features/projects/ProjectStates";

describe("state components", () => {
  it("renders an empty state with a call to action", () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Create the first thing."
        action={<button type="button">Create</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Nothing here" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Create the first thing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("renders an error state and calls retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    expect(
      screen.getByRole("heading", { name: "Could not load this page" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders an accessible page skeleton", () => {
    render(<PageSkeleton label="Loading projects" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading projects")).toBeInTheDocument();
  });

  it("renders the project not-found and forbidden panels", () => {
    render(
      <MemoryRouter>
        <ProjectNotFound />
        <ProjectForbidden />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Project not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "You don't have access" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Back to projects/ }),
    ).toHaveLength(2);
  });
});
