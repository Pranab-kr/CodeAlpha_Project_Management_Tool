import type { ProjectDetail } from "@teamboard/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DangerZone from "./DangerZone";
import { renderWithProviders } from "../../test/render";

const { deleteMutateAsync } = vi.hoisted(() => ({
  deleteMutateAsync: vi.fn(),
}));

vi.mock("./useProjects", () => ({
  useDeleteProject: () => ({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  }),
}));

function makeProject(role: ProjectDetail["role"]): ProjectDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Website Redesign",
    description: "",
    ownerId: "u1",
    role,
    memberCount: 1,
    taskCount: 0,
    members: [],
    columns: [],
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
  };
}

describe("DangerZone", () => {
  beforeEach(() => {
    deleteMutateAsync.mockReset();
    deleteMutateAsync.mockResolvedValue(undefined);
  });

  it("requires the exact project name before deleting", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZone project={makeProject("owner")} />);

    const button = screen.getByRole("button", { name: "Delete project" });
    expect(button).toBeDisabled();

    const input = screen.getByLabelText(/type the project name/i);
    await user.type(input, "Website");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The name does not match exactly.",
    );
    expect(button).toBeDisabled();

    await user.clear(input);
    await user.type(input, "Website Redesign");
    expect(button).toBeEnabled();

    await user.click(button);
    expect(deleteMutateAsync).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("disables deletion for non-owners", () => {
    renderWithProviders(<DangerZone project={makeProject("member")} />);
    expect(
      screen.getByText("Only the project owner can delete this project."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete project" }),
    ).toBeDisabled();
    expect(
      screen.queryByLabelText(/type the project name/i),
    ).not.toBeInTheDocument();
  });
});
