import { describe, expect, it } from "vitest";
import { createTaskSchema, moveTaskSchema, updateTaskSchema } from "./tasks.js";

describe("task schemas", () => {
  it("defaults description and priority on create", () => {
    expect(
      createTaskSchema.parse({
        columnId: "11111111-1111-4111-8111-111111111111",
        title: "  Fix rotation  ",
      }),
    ).toEqual({
      columnId: "11111111-1111-4111-8111-111111111111",
      title: "Fix rotation",
      description: "",
      priority: "medium",
    });
  });

  it("rejects a 201-character title and accepts null dates and assignees", () => {
    expect(
      createTaskSchema.safeParse({
        columnId: "11111111-1111-4111-8111-111111111111",
        title: "x".repeat(201),
      }).success,
    ).toBe(false);

    expect(
      createTaskSchema.safeParse({
        columnId: "11111111-1111-4111-8111-111111111111",
        title: "Valid",
        dueDate: null,
        assigneeId: null,
      }).success,
    ).toBe(true);

    expect(
      createTaskSchema.safeParse({
        columnId: "11111111-1111-4111-8111-111111111111",
        title: "Valid",
        dueDate: "15/11/2026",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty update but accepts a single field", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.parse({ dueDate: null })).toEqual({
      dueDate: null,
    });
    expect(updateTaskSchema.safeParse({ priority: "urgent" }).success).toBe(
      true,
    );
  });

  it("accepts a move with both neighbours omitted", () => {
    expect(
      moveTaskSchema.parse({
        columnId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({ columnId: "11111111-1111-4111-8111-111111111111" });
  });
});
