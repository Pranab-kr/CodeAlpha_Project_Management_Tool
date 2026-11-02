import { describe, expect, it } from "vitest";
import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
  notificationSchema,
} from "./notifications.js";

describe("notification contracts", () => {
  it("coerces a numeric limit string and defaults to 10", () => {
    expect(notificationListQuerySchema.parse({ limit: "20" })).toEqual({
      limit: 20,
    });
    expect(notificationListQuerySchema.parse({})).toEqual({ limit: 10 });
  });

  it("rejects limits outside 1–50 and non-numeric values", () => {
    for (const limit of ["0", "51", "abc", -1, 1.5]) {
      expect(notificationListQuerySchema.safeParse({ limit }).success).toBe(
        false,
      );
    }
    expect(notificationListQuerySchema.safeParse({ limit: "1" }).success).toBe(
      true,
    );
    expect(notificationListQuerySchema.safeParse({ limit: "50" }).success).toBe(
      true,
    );
  });

  it("rejects a cursor longer than 500 characters", () => {
    expect(
      notificationListQuerySchema.safeParse({ cursor: "x".repeat(501) })
        .success,
    ).toBe(false);
    expect(
      notificationListQuerySchema.safeParse({ cursor: "x".repeat(500) })
        .success,
    ).toBe(true);
  });

  it("accepts only uuid notification ids", () => {
    expect(
      notificationIdParamsSchema.safeParse({
        id: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
    expect(notificationIdParamsSchema.safeParse({ id: "nope" }).success).toBe(
      false,
    );
  });

  it("describes a joined notification with a nullable task and excerpt", () => {
    const notification = {
      id: "22222222-2222-4222-8222-222222222222",
      type: "comment_added",
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
        title: "Build tokens",
      },
      commentExcerpt: "Keep indigo as the primary",
    };

    expect(notificationSchema.safeParse(notification).success).toBe(true);
    expect(
      notificationSchema.safeParse({ ...notification, task: null }).success,
    ).toBe(true);
    expect(
      notificationSchema.safeParse({ ...notification, type: "mention" })
        .success,
    ).toBe(false);
  });
});
