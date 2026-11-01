import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("GET /api/health", () => {
  it("returns ok when the database check passes", async () => {
    const app = createApp({ healthCheck: async () => true });
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "ok", db: "up" });
  });

  it("returns 503 when the database check fails", async () => {
    const app = createApp({ healthCheck: async () => false });
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DB_UNAVAILABLE");
  });
});
