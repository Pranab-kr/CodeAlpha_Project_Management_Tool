import type { Comment } from "@teamboard/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommentsSection from "./CommentsSection";
import { renderWithProviders } from "../../test/render";

const {
  useAuthMock,
  listMock,
  createMock,
  updateMock,
  deleteMock,
  toastError,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  listMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../auth/useAuth", () => ({ useAuth: useAuthMock }));
vi.mock("./comments.api", () => ({
  listComments: listMock,
  createComment: createMock,
  updateComment: updateMock,
  deleteComment: deleteMock,
}));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
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
const sam = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "sam@teamboard.dev",
  name: "Sam Rivera",
  initials: "SR",
  createdAt: "2026-11-01T10:00:00.000Z",
};
const mayaSummary = {
  id: maya.id,
  email: maya.email,
  name: maya.name,
  initials: maya.initials,
};
const devSummary = {
  id: dev.id,
  email: dev.email,
  name: dev.name,
  initials: dev.initials,
};

const taskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    taskId,
    body: "First comment",
    author: devSummary,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

function renderSection(canModerate = false) {
  return renderWithProviders(
    <CommentsSection
      taskId={taskId}
      projectId={projectId}
      canModerate={canModerate}
    />,
  );
}

beforeEach(() => {
  useAuthMock.mockReset();
  listMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  toastError.mockReset();
  useAuthMock.mockReturnValue({ user: maya, isLoading: false });
  listMock.mockResolvedValue({ comments: [] });
  createMock.mockResolvedValue({
    comment: makeComment({ author: mayaSummary }),
  });
  updateMock.mockResolvedValue({
    comment: makeComment({ author: mayaSummary, body: "Edited" }),
  });
  deleteMock.mockResolvedValue(undefined);
});

describe("CommentsSection", () => {
  it("renders comments oldest-first and marks edited comments", async () => {
    const first = makeComment({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
      body: "First comment",
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
    });
    const second = makeComment({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccc02",
      body: "Second comment",
      createdAt: "2026-11-02T10:00:00.000Z",
      updatedAt: "2026-11-02T11:00:00.000Z",
      author: mayaSummary,
    });
    listMock.mockResolvedValue({ comments: [first, second] });

    renderSection();

    const list = await screen.findByRole("list", { name: "Comments" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("First comment");
    expect(items[1]).toHaveTextContent("Second comment");
    expect(items[0]).not.toHaveTextContent("(edited)");
    expect(items[1]).toHaveTextContent("(edited)");
  });

  it("shows edit and delete controls on your own comment", async () => {
    listMock.mockResolvedValue({
      comments: [makeComment({ author: mayaSummary })],
    });

    renderSection();

    expect(
      await screen.findByRole("button", { name: "Edit comment" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete comment" }),
    ).toBeInTheDocument();
  });

  it("hides controls on another member's comment from a plain member", async () => {
    listMock.mockResolvedValue({ comments: [makeComment()] });

    renderSection(false);

    expect(await screen.findByText("First comment")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit comment" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete comment" }),
    ).not.toBeInTheDocument();
  });

  it("lets an admin delete another member's comment but not edit it", async () => {
    useAuthMock.mockReturnValue({ user: sam, isLoading: false });
    listMock.mockResolvedValue({ comments: [makeComment()] });

    renderSection(true);

    expect(
      await screen.findByRole("button", { name: "Delete comment" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit comment" }),
    ).not.toBeInTheDocument();
  });

  it("renders the empty state", async () => {
    renderSection();

    expect(
      await screen.findByText("No comments yet. Start the conversation."),
    ).toBeInTheDocument();
  });

  it("shows an optimistic comment and rolls it back when posting fails", async () => {
    const user = userEvent.setup();
    let rejectCreate!: (reason: Error) => void;
    createMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject;
        }),
    );

    renderSection();
    await screen.findByText("No comments yet. Start the conversation.");

    await user.type(screen.getByLabelText("Comment"), "Optimistic note");
    await user.click(screen.getByRole("button", { name: "Post comment" }));

    const list = await screen.findByRole("list", { name: "Comments" });
    expect(
      await within(list).findByText("Optimistic note"),
    ).toBeInTheDocument();
    expect(createMock).toHaveBeenCalledWith(taskId, "Optimistic note");

    await act(async () => {
      rejectCreate(new Error("Network down"));
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Could not post the comment"),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("list", { name: "Comments" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText("No comments yet. Start the conversation."),
    ).toBeInTheDocument();
  });

  it("keeps the previous body and toasts when an edit fails", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue({
      comments: [makeComment({ author: mayaSummary, body: "Original body" })],
    });
    let rejectUpdate!: (reason: Error) => void;
    updateMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectUpdate = reject;
        }),
    );

    renderSection();
    await screen.findByText("Original body");

    await user.click(screen.getByRole("button", { name: "Edit comment" }));
    const editor = screen.getByLabelText("Edit comment body");
    await user.clear(editor);
    await user.type(editor, "Attempted edit");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await act(async () => {
      rejectUpdate(new Error("Network down"));
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Could not save the comment"),
    );
    expect(await screen.findByText("Original body")).toBeInTheDocument();
    expect(screen.queryByText("Attempted edit")).not.toBeInTheDocument();
  });

  it("requires confirmation before deleting and removes the comment", async () => {
    const user = userEvent.setup();
    const comment = makeComment({ author: mayaSummary, body: "Delete me" });
    listMock
      .mockResolvedValueOnce({ comments: [comment] })
      .mockResolvedValue({ comments: [] });

    renderSection();
    await screen.findByText("Delete me");

    await user.click(screen.getByRole("button", { name: "Delete comment" }));
    expect(await screen.findByText("Delete this comment?")).toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(comment.id));
    await waitFor(() =>
      expect(screen.queryByText("Delete me")).not.toBeInTheDocument(),
    );
  });
});
