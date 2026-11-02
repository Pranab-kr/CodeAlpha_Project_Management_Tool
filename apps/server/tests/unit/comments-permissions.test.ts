import { describe, expect, it } from "vitest";
import { canDeleteComment } from "../../src/modules/comments/comments.permissions.js";

describe("canDeleteComment", () => {
  it("allows the author, an admin, and the owner", () => {
    expect(canDeleteComment("member", "author", "author")).toBe(true);
    expect(canDeleteComment("admin", "author", "someone-else")).toBe(true);
    expect(canDeleteComment("owner", "author", "someone-else")).toBe(true);
  });

  it("forbids a plain member deleting someone else's comment", () => {
    expect(canDeleteComment("member", "author", "someone-else")).toBe(false);
  });
});
