import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfileDialog from "./ProfileDialog";
import { ApiError } from "../../lib/api";
import { renderWithProviders } from "../../test/render";

const { updateProfileMock } = vi.hoisted(() => ({
  updateProfileMock: vi.fn(),
}));

vi.mock("../projects/useProjects", () => ({
  useUpdateProfile: () => ({
    mutateAsync: updateProfileMock,
    isPending: false,
  }),
}));

const maya = {
  id: "u1",
  email: "maya@teamboard.dev",
  name: "Maya Chen",
  initials: "MC",
  createdAt: "2026-11-01T10:00:00.000Z",
};

describe("ProfileDialog", () => {
  beforeEach(() => {
    updateProfileMock.mockReset();
    updateProfileMock.mockResolvedValue({ user: maya });
  });

  it("prefills the current name and submits a trimmed value", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ProfileDialog user={maya} open onOpenChange={onOpenChange} />,
    );

    const input = screen.getByLabelText("Display name");
    expect(input).toHaveValue("Maya Chen");

    await user.clear(input);
    await user.type(input, "  Maya C.  ");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(updateProfileMock).toHaveBeenCalledWith("Maya C.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a server error inline and stays open", async () => {
    updateProfileMock.mockRejectedValueOnce(
      new ApiError(409, "NAME_TAKEN", "That name is already in use"),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ProfileDialog user={maya} open onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(
      await screen.findByText("That name is already in use"),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
