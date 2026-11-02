import type { Notification } from "@teamboard/shared";
import { describe, expect, it } from "vitest";
import { notificationCopy } from "./notification-copy";

const base: Notification = {
  id: "22222222-2222-4222-8222-222222222222",
  type: "task_assigned",
  readAt: null,
  createdAt: "2026-11-02T10:00:00.000Z",
  actor: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "maya@teamboard.dev",
    name: "Maya Chen",
    initials: "MC",
  },
  project: {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Website Redesign",
  },
  task: {
    id: "44444444-4444-4444-8444-444444444444",
    title: "Build the new design tokens",
  },
  commentExcerpt: null,
};

describe("notificationCopy", () => {
  it("describes an assignment with actor, task, and project", () => {
    const copy = notificationCopy(base);

    expect(copy).toBe(
      "Maya Chen assigned you Build the new design tokens in Website Redesign.",
    );
  });

  it("describes a comment with the excerpt", () => {
    const copy = notificationCopy({
      ...base,
      type: "comment_added",
      commentExcerpt: "Keep indigo as the primary",
    });

    expect(copy).toContain("Maya Chen commented on");
    expect(copy).toContain("Build the new design tokens");
    expect(copy).toContain("Website Redesign");
    expect(copy).toContain("“Keep indigo as the primary”");
  });

  it("produces plain text, never markup", () => {
    const copy = notificationCopy({
      ...base,
      type: "comment_added",
      commentExcerpt: "<script>alert(1)</script>",
    });

    expect(copy).toContain("<script>alert(1)</script>");
    expect(copy.startsWith("<")).toBe(false);
    expect(copy).not.toContain("<strong>");
  });
});
