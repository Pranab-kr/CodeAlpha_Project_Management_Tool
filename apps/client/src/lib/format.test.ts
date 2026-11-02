import { describe, expect, it } from "vitest";
import {
  formatDueDate,
  initialsColor,
  isOverdue,
  parseLocalDate,
} from "./format";

describe("format", () => {
  it("formats a date-only string as a local calendar date", () => {
    expect(formatDueDate("2026-11-15")).toBe("Nov 15");
    const parsed = parseLocalDate("2026-11-15");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(10);
    expect(parsed.getDate()).toBe(15);
  });

  it("compares overdue dates by local calendar day", () => {
    const today = new Date(2026, 10, 15, 18, 30);
    expect(isOverdue("2026-11-14", today)).toBe(true);
    expect(isOverdue("2026-11-15", today)).toBe(false);
    expect(isOverdue("2026-11-16", today)).toBe(false);
    expect(isOverdue(null, today)).toBe(false);
  });

  it("returns a deterministic color for an id", () => {
    expect(initialsColor("user-1")).toBe(initialsColor("user-1"));
    expect(initialsColor("user-1")).toMatch(/^bg-/);
  });
});
