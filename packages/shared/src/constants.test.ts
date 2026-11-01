import { describe, expect, it } from "vitest";
import {
  PROJECT_ROLES,
  TASK_PRIORITIES,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from "./constants.js";

describe("shared constants", () => {
  it("exposes the canonical roles, priorities, and cookie names", () => {
    expect(PROJECT_ROLES).toEqual(["owner", "admin", "member"]);
    expect(TASK_PRIORITIES).toEqual(["low", "medium", "high", "urgent"]);
    expect(ACCESS_COOKIE).toBe("ca_access");
    expect(REFRESH_COOKIE).toBe("ca_refresh");
  });
});
