import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { closeTestPool } from "../helpers/db.js";

afterAll(closeTestPool);

const loginBody = {
  email: "nobody@example.com",
  password: "Password123!",
};

describe("origin guard", () => {
  it("rejects unsafe requests from a foreign origin", async () => {
    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .set("Origin", "https://evil.example")
      .send(loginBody);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("allows unsafe requests from the configured app origin", async () => {
    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .send(loginBody);
    expect(res.status).not.toBe(403);
  });

  it("allows unsafe requests without an Origin header (CLI and tests)", async () => {
    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .send(loginBody);
    expect(res.status).not.toBe(403);
  });
});
