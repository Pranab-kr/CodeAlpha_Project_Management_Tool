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

  it("allows the request's own origin when it differs from APP_ORIGIN", async () => {
    // Reproduces opening the production-shaped build on the API port:
    // Origin and Host agree, but neither matches the dev APP_ORIGIN.
    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .set("Host", "127.0.0.1:4000")
      .set("Origin", "http://127.0.0.1:4000")
      .send(loginBody);
    expect(res.status).not.toBe(403);
  });

  it("compares origins case-insensitively and ignores default ports", async () => {
    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .set("Origin", "HTTP://LOCALHOST:5173")
      .send(loginBody);
    expect(res.status).not.toBe(403);
  });

  it("trusts the forwarded public origin behind a reverse proxy", async () => {
    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .set("Host", "localhost:4000")
      .set("X-Forwarded-Host", "teamboard.example")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://teamboard.example")
      .send(loginBody);
    expect(res.status).not.toBe(403);
  });

  it("rejects an opaque or malformed origin", async () => {
    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .set("Origin", "null")
      .send(loginBody);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ORIGIN");
  });
});
