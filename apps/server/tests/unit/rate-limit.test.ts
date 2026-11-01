import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../../src/middleware/rate-limit.js";

describe("createRateLimiter", () => {
  it("returns 429 with the standard envelope once the limit is exceeded", async () => {
    const app = express();
    app.get(
      "/ping",
      createRateLimiter({ windowMs: 60_000, max: 2 }),
      (_req, res) => {
        res.json({ data: { ok: true } });
      },
    );

    await request(app).get("/ping").expect(200);
    await request(app).get("/ping").expect(200);

    const limited = await request(app).get("/ping");
    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatchObject({ code: "RATE_LIMITED" });
  });
});
