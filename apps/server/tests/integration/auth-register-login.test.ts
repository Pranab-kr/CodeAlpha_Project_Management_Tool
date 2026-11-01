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

describe("auth register/login", () => {
  it("registers a user with httpOnly cookies and no hash leak", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: "maya@example.com",
      name: "Maya Chen",
    });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.join(";")).toContain("ca_access=");
    expect(cookies.join(";")).toContain("ca_refresh=");
    expect(cookies.join(";")).toContain("HttpOnly");
  });

  it("rejects duplicate emails and invalid payloads", async () => {
    await request(app).post("/api/v1/auth/register").send(body).expect(201);
    const duplicate = await request(app)
      .post("/api/v1/auth/register")
      .send(body);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_TAKEN");

    const invalid = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "", email: "nope", password: "short" });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const tooManyBytes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Byte Limit",
        email: "bytes@example.com",
        password: "é".repeat(37),
      });
    expect(tooManyBytes.status).toBe(422);
    expect(tooManyBytes.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with the same generic error for unknown email and bad password", async () => {
    await request(app).post("/api/v1/auth/register").send(body).expect(201);
    const ok = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: body.email, password: body.password });
    expect(ok.status).toBe(200);

    for (const payload of [
      { email: "missing@example.com", password: body.password },
      { email: body.email, password: "WrongPassword!" },
    ]) {
      const res = await request(app).post("/api/v1/auth/login").send(payload);
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }
  });
});
