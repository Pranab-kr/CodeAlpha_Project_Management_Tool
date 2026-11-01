import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("unknown routes", () => {
  it("returns the standard error envelope", async () => {
    const res = await request(createApp()).get("/api/v1/missing");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });
});
