import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { closeTestPool, resetDb } from "../helpers/db.js";

const app = createApp();
beforeEach(resetDb);
afterAll(closeTestPool);

const body = {
  name: "Maya Chen",
  email: "maya@example.com",
  password: "Password123!",
};

/** Turn set-cookie headers into a Cookie request header (attributes stripped). */
const toCookieHeader = (setCookies: string[]): string =>
  setCookies
    .filter(
      (cookie) =>
        cookie.startsWith("ca_access=") || cookie.startsWith("ca_refresh="),
    )
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

const registerAndGetCookies = async (): Promise<string[]> => {
  const res = await request(app).post("/api/v1/auth/register").send(body);
  expect(res.status).toBe(201);
  return res.headers["set-cookie"] as unknown as string[];
};

describe("auth session", () => {
  it("rotates the refresh token and rejects reuse by revoking all sessions", async () => {
    const cookies = await registerAndGetCookies();
    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", toCookieHeader(cookies));
    expect(rotated.status).toBe(200);
    const newCookies = rotated.headers["set-cookie"] as unknown as string[];

    const reuse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", toCookieHeader(cookies));
    expect(reuse.status).toBe(401);

    const afterReuse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", toCookieHeader(newCookies));
    expect(afterReuse.status).toBe(401);
  });

  it("logs out, clears cookies, and does not accept the old refresh token", async () => {
    const cookies = await registerAndGetCookies();
    const header = toCookieHeader(cookies);
    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", header);
    expect(logout.status).toBe(204);
    expect(
      (logout.headers["set-cookie"] as unknown as string[]).join(";"),
    ).toContain("ca_access=;");
    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", header);
    expect(refresh.status).toBe(401);
  });

  it("returns the current user only with a valid access cookie", async () => {
    const cookies = await registerAndGetCookies();
    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", toCookieHeader(cookies));
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(body.email);
    await request(app).get("/api/v1/auth/me").expect(401);
  });
});
