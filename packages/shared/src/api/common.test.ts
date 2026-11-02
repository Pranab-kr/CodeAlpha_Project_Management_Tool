import { describe, expect, it } from "vitest";
import { projectRoleSchema, userSummarySchema } from "./common.js";

describe("common contracts", () => {
  it("accepts the three project roles and rejects unknown ones", () => {
    for (const role of ["owner", "admin", "member"]) {
      expect(projectRoleSchema.parse(role)).toBe(role);
    }
    expect(projectRoleSchema.safeParse("guest").success).toBe(false);
  });

  it("rejects a summary with a non-UUID id", () => {
    expect(
      userSummarySchema.safeParse({
        id: "not-a-uuid",
        email: "dev@teamboard.dev",
        name: "Dev Patel",
        initials: "DP",
      }).success,
    ).toBe(false);
  });
});
