import { describe, expect, it } from "vitest";
import { isManager } from "../../src/modules/projects/projects.permissions.js";

describe("project permissions", () => {
  it("treats owners and admins as managers", () => {
    expect(isManager("owner")).toBe(true);
    expect(isManager("admin")).toBe(true);
    expect(isManager("member")).toBe(false);
  });
});
