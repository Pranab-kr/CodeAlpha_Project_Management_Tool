import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewProjectDialog from "./NewProjectDialog";
import { renderWithProviders } from "../../test/render";

const { mutateAsyncMock } = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn(),
}));

vi.mock("./useProjects", () => ({
  useCreateProject: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe("NewProjectDialog", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({
      project: { id: "p1", name: "Phase 2 Demo" },
    });
  });

  it("blocks an empty name and does not call the mutation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewProjectDialog />);

    await user.click(screen.getByRole("button", { name: "New project" }));
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText(/too small/i)).toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("submits once and closes on success", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewProjectDialog />);

    await user.click(screen.getByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Project name"), "Phase 2 Demo");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      name: "Phase 2 Demo",
      description: "",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows a server error and keeps the dialog open", async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error("Network down"));
    const user = userEvent.setup();
    renderWithProviders(<NewProjectDialog />);

    await user.click(screen.getByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Project name"), "Phase 2 Demo");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      await screen.findByText(
        /could not create the project\. please try again\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
