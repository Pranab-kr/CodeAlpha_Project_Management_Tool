import { describe, expect, it } from "vitest";
import {
  commentBodySchema,
  commentIdParamsSchema,
  commentSchema,
} from "./comments.js";

const author = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "maya@teamboard.dev",
  name: "Maya Chen",
  initials: "MC",
};

describe("comment contracts", () => {
  it("trims the body", () => {
    expect(commentBodySchema.parse({ body: "  Looks good  " })).toEqual({
      body: "Looks good",
    });
  });

  it("rejects empty and whitespace-only bodies", () => {
    expect(commentBodySchema.safeParse({ body: "" }).success).toBe(false);
    expect(commentBodySchema.safeParse({ body: "   \n  " }).success).toBe(
      false,
    );
  });

  it("accepts 5,000 characters and rejects 5,001", () => {
    expect(
      commentBodySchema.safeParse({ body: "x".repeat(5000) }).success,
    ).toBe(true);
    expect(
      commentBodySchema.safeParse({ body: "x".repeat(5001) }).success,
    ).toBe(false);
  });

  it("requires an author summary on a comment", () => {
    const comment = {
      id: "22222222-2222-4222-8222-222222222222",
      taskId: "33333333-3333-4333-8333-333333333333",
      body: "Looks good",
      author,
      createdAt: "2026-11-02T10:00:00.000Z",
      updatedAt: "2026-11-02T10:00:00.000Z",
    };

    expect(commentSchema.safeParse(comment).success).toBe(true);
    const { author: _author, ...withoutAuthor } = comment;
    expect(commentSchema.safeParse(withoutAuthor).success).toBe(false);
  });

  it("accepts only uuid comment ids", () => {
    expect(
      commentIdParamsSchema.safeParse({
        commentId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
    expect(commentIdParamsSchema.safeParse({ commentId: "nope" }).success).toBe(
      false,
    );
  });
});
