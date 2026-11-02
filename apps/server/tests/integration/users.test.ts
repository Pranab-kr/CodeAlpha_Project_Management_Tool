import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import { users } from "../../src/db/schema/index.js";
import { registerSession } from "../helpers/auth.js";
import { closeTestPool, resetDb } from "../helpers/db.js";

const app = createApp();

beforeEach(resetDb);
afterAll(closeTestPool);

async function insertUser(email: string, name: string) {
  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash: "hash" })
    .returning();
  return user;
}

describe("PATCH /users/me", () => {
  it("updates the display name and ignores an email field", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", maya.cookies)
      .send({ name: "  Maya Chen Updated  ", email: "evil@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      id: maya.user.id,
      name: "Maya Chen Updated",
      email: "maya@example.com",
      initials: "MC",
    });
  });

  it("requires authentication", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .send({ name: "Anonymous" });
    expect(response.status).toBe(401);
  });

  it("rejects empty bodies and attempts to change email or password", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    for (const payload of [
      {},
      { email: "other@example.com" },
      { password: "NewPassword123!" },
    ]) {
      const response = await request(app)
        .patch("/api/v1/users/me")
        .set("Cookie", maya.cookies)
        .send(payload);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("GET /users", () => {
  it("returns at most ten matching users without the caller and without createdAt", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    for (let index = 0; index < 12; index += 1) {
      await insertUser(`dev${index}@example.com`, `Developer ${index}`);
    }

    const response = await request(app)
      .get("/api/v1/users")
      .query({ search: "DEV" })
      .set("Cookie", maya.cookies);

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(10);
    for (const user of response.body.data.users) {
      expect(user).not.toHaveProperty("createdAt");
      expect(user.email).toContain("dev");
      expect(user.initials).toBeTruthy();
    }
    expect(
      response.body.data.users.some(
        (user: { id: string }) => user.id === maya.user.id,
      ),
    ).toBe(false);
  });

  it("matches names, excludes the caller, and returns empty without a query", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    await insertUser("someone@example.com", "Dev Patel");

    const byName = await request(app)
      .get("/api/v1/users")
      .query({ search: "patel" })
      .set("Cookie", maya.cookies);
    expect(byName.status).toBe(200);
    expect(byName.body.data.users).toHaveLength(1);

    const yourself = await request(app)
      .get("/api/v1/users")
      .query({ search: "maya" })
      .set("Cookie", maya.cookies);
    expect(yourself.status).toBe(200);
    expect(yourself.body.data.users).toEqual([]);

    const none = await request(app)
      .get("/api/v1/users")
      .set("Cookie", maya.cookies);
    expect(none.status).toBe(200);
    expect(none.body.data.users).toEqual([]);
  });

  it("validates a too-long query and requires authentication", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const tooLong = await request(app)
      .get("/api/v1/users")
      .query({ search: "x".repeat(101) })
      .set("Cookie", maya.cookies);
    expect(tooLong.status).toBe(422);
    expect(tooLong.body.error.code).toBe("VALIDATION_ERROR");

    const anonymous = await request(app)
      .get("/api/v1/users")
      .query({ search: "dev" });
    expect(anonymous.status).toBe(401);
  });
});
