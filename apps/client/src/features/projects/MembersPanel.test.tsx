import type { ProjectDetail } from "@teamboard/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MembersPanel from "./MembersPanel";
import { renderWithProviders } from "../../test/render";

const { useAuthMock, removeMutateAsync, roleMutateAsync } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  removeMutateAsync: vi.fn(),
  roleMutateAsync: vi.fn(),
}));

vi.mock("../../features/auth/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("./useProjects", () => ({
  useUpdateMemberRole: () => ({
    mutateAsync: roleMutateAsync,
    isPending: false,
  }),
  useRemoveMember: () => ({
    mutateAsync: removeMutateAsync,
    isPending: false,
  }),
  useAddMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSearchUsers: () => ({ data: [], isPending: false }),
}));

const maya = {
  id: "u-maya",
  email: "maya@teamboard.dev",
  name: "Maya Chen",
  initials: "MC",
  createdAt: "2026-11-01T10:00:00.000Z",
};
const sam = {
  id: "u-sam",
  email: "sam@teamboard.dev",
  name: "Sam Rivera",
  initials: "SR",
  createdAt: "2026-11-01T10:00:00.000Z",
};
const dev = {
  id: "u-dev",
  email: "dev@teamboard.dev",
  name: "Dev Patel",
  initials: "DP",
  createdAt: "2026-11-01T10:00:00.000Z",
};

function makeProject(role: ProjectDetail["role"]): ProjectDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Website Redesign",
    description: "Refresh the site",
    ownerId: maya.id,
    role,
    memberCount: 3,
    taskCount: 0,
    columns: [],
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
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
        userId: sam.id,
        email: sam.email,
        name: sam.name,
        initials: sam.initials,
        role: "admin",
        joinedAt: "2026-11-01T11:00:00.000Z",
      },
      {
        userId: dev.id,
        email: dev.email,
        name: dev.name,
        initials: dev.initials,
        role: "member",
        joinedAt: "2026-11-01T12:00:00.000Z",
      },
    ],
  };
}

describe("MembersPanel", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    removeMutateAsync.mockReset();
    roleMutateAsync.mockReset();
    removeMutateAsync.mockResolvedValue(undefined);
  });

  it("shows management controls to the owner", () => {
    useAuthMock.mockReturnValue({ user: maya, isLoading: false });
    renderWithProviders(<MembersPanel project={makeProject("owner")} />);

    expect(
      screen.getByRole("button", { name: "Add member" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Role for Sam Rivera")).toBeInTheDocument();
    expect(screen.getByLabelText("Role for Dev Patel")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Sam Rivera" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Dev Patel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Maya Chen")).toBeInTheDocument();
  });

  it("hides management controls from a member but offers leave", () => {
    useAuthMock.mockReturnValue({ user: dev, isLoading: false });
    renderWithProviders(<MembersPanel project={makeProject("member")} />);

    expect(
      screen.queryByRole("button", { name: "Add member" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/role for/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Leave project" }),
    ).toBeInTheDocument();
  });

  it("asks for confirmation before removing a member", async () => {
    useAuthMock.mockReturnValue({ user: maya, isLoading: false });
    const user = userEvent.setup();
    renderWithProviders(<MembersPanel project={makeProject("owner")} />);

    await user.click(screen.getByRole("button", { name: "Remove Dev Patel" }));
    expect(await screen.findByText("Remove Dev Patel?")).toBeInTheDocument();
    expect(removeMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(removeMutateAsync).toHaveBeenCalledWith(dev.id));
  });
});
