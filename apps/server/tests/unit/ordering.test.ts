import { describe, expect, it } from "vitest";
import {
  appendPosition,
  computePosition,
  needsRenumber,
  renumberedPositions,
} from "../../src/lib/ordering.js";

describe("ordering", () => {
  it("appends with a 1024 gap", () => {
    expect(appendPosition(null)).toBe(1024);
    expect(appendPosition(3072)).toBe(4096);
  });

  it("computes top, middle, and bottom positions", () => {
    expect(computePosition(null, 1024)).toBe(0);
    expect(computePosition(1024, 2048)).toBe(1536);
    expect(computePosition(2048, null)).toBe(3072);
  });

  it("flags tiny gaps but not missing neighbours", () => {
    expect(needsRenumber(1024, 2048)).toBe(false);
    expect(needsRenumber(1024, 1024 + 1e-7)).toBe(true);
    expect(needsRenumber(null, 1024)).toBe(false);
  });

  it("renumbers to growing 1024 gaps", () => {
    expect(renumberedPositions(3)).toEqual([1024, 2048, 3072]);
    expect(renumberedPositions(0)).toEqual([]);
  });
});
