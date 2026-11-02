import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { closeTestPool, resetDb } from "../helpers/db.js";
import {
  connectSocket,
  startSocketServer,
  stopSocketServer,
  waitForConnect,
  waitForConnectError,
} from "../helpers/socket.js";

const app = createApp();

beforeEach(resetDb);
afterEach(stopSocketServer);
afterAll(closeTestPool);

describe("socket authentication", () => {
  it("rejects a connection without the access cookie", async () => {
    const { url } = await startSocketServer();
    const socket = connectSocket(url, []);
    const error = await waitForConnectError(socket);
    expect(error.message).toBe("UNAUTHORIZED");
    expect(socket.connected).toBe(false);
  });

  it("accepts a registered user's cookie", async () => {
    const { url } = await startSocketServer();
    const register = await request(app).post("/api/v1/auth/register").send({
      name: "Maya",
      email: "maya@example.com",
      password: "Password123!",
    });
    expect(register.status).toBe(201);

    const cookies = (register.headers["set-cookie"] as unknown as string[]).map(
      (cookie) => cookie.split(";")[0],
    );
    const socket = connectSocket(url, cookies);
    await waitForConnect(socket);
    expect(socket.connected).toBe(true);
  });
});
