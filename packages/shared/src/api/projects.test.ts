import { describe, expect, it } from "vitest";
import {
  addMemberSchema,
  createProjectSchema,
  updateProjectSchema,
  updateMemberRoleSchema,
} from "./projects.js";

describe("project schemas", () => {
  it("normalizes member email and defaults the description", () => {
    expect(createProjectSchema.parse({ name: "  Website  " })).toEqual({
      name: "Website",
      description: "",
    });
    expect(addMemberSchema.parse({ email: " DEV@Example.COM " })).toEqual({
      email: "dev@example.com",
    });
  });

  it("rejects empty names, long descriptions, and empty updates", () => {
    expect(createProjectSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(
      createProjectSchema.safeParse({
        name: "P",
        description: "x".repeat(2001),
      }).success,
    ).toBe(false);
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });

  it("only allows admin or member role changes", () => {
    expect(updateMemberRoleSchema.parse({ role: "admin" })).toEqual({
      role: "admin",
    });
    expect(updateMemberRoleSchema.safeParse({ role: "owner" }).success).toBe(
      false,
    );
  });
});
