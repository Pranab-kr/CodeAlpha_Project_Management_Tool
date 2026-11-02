import type { ProjectListItem } from "@teamboard/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";
import { renderWithProviders } from "../../test/render";

const { useProjectsMock, refetchMock } = vi.hoisted(() => ({
  useProjectsMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock("../../features/projects/useProjects", () => ({
  useProjects: useProjectsMock,
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function makeProject(
  id: string,
  name: string,
  role: "owner" | "member" = "member",
): ProjectListItem {
  return {
    id,
    name,
    description: "",
    ownerId: "owner-1",
    role,
    memberCount: 1,
    taskCount: 0,
    members: [],
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
  };
}

describe("Sidebar", () => {
  beforeEach(() => {
    useProjectsMock.mockReset();
    refetchMock.mockReset();
    useProjectsMock.mockReturnValue({
      data: [
        makeProject("p1", "Website Redesign", "owner"),
        makeProject("p2", "Mobile App Launch"),
      ],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });
  });

  it("lists projects with deterministic compact initials", () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText("Website Redesign")).toBeInTheDocument();
    expect(screen.getByText("Mobile App Launch")).toBeInTheDocument();
    expect(screen.getByText("WR")).toBeInTheDocument();
    expect(screen.getByText("MA")).toBeInTheDocument();
  });

  it("opens the new project dialog from the sidebar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar />);

    await user.click(screen.getByRole("button", { name: "New project" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("renders an empty state and a retry state", () => {
    useProjectsMock.mockReturnValueOnce({
      data: [],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });
    const { unmount } = renderWithProviders(<Sidebar />);
    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
    unmount();

    useProjectsMock.mockReturnValueOnce({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: refetchMock,
    });
    renderWithProviders(<Sidebar />);
    expect(
      screen.getByRole("button", { name: /could not load projects/i }),
    ).toBeInTheDocument();
  });
});
