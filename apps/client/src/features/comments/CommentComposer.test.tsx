import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CommentComposer from "./CommentComposer";
import { renderWithProviders } from "../../test/render";

describe("CommentComposer", () => {
  it("blocks empty and whitespace-only comments with an inline error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(
      <CommentComposer onSubmit={onSubmit} isPending={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /write a comment first/i,
    );

    await user.type(screen.getByLabelText("Comment"), "   ");
    await user.click(screen.getByRole("button", { name: "Post comment" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed body and clears the textarea", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <CommentComposer onSubmit={onSubmit} isPending={false} />,
    );

    await user.type(screen.getByLabelText("Comment"), "  Looks good  ");
    await user.click(screen.getByRole("button", { name: "Post comment" }));

    expect(onSubmit).toHaveBeenCalledWith("Looks good");
    await waitFor(() =>
      expect(screen.getByLabelText("Comment")).toHaveValue(""),
    );
  });

  it("keeps the draft when the submit fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("offline"));
    renderWithProviders(
      <CommentComposer onSubmit={onSubmit} isPending={false} />,
    );

    await user.type(screen.getByLabelText("Comment"), "Please retry");
    await user.click(screen.getByRole("button", { name: "Post comment" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByLabelText("Comment")).toHaveValue("Please retry");
  });

  it("disables the button while pending", () => {
    renderWithProviders(<CommentComposer onSubmit={vi.fn()} isPending />);

    expect(screen.getByRole("button", { name: "Posting…" })).toBeDisabled();
  });

  it("submits with Enter and inserts a newline with Shift+Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <CommentComposer onSubmit={onSubmit} isPending={false} />,
    );

    const textarea = screen.getByLabelText("Comment");
    await user.type(textarea, "Line one");
    await user.type(textarea, "{Shift>}{Enter}{/Shift}Line two");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("Line one\nLine two");

    await user.type(textarea, "{Enter}");
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Line one\nLine two"),
    );
  });
});
