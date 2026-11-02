import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { getOnlineUserIds } from "../../src/realtime/presence.js";
import { registerSession, type TestSession } from "../helpers/auth.js";
import { closeTestPool, resetDb } from "../helpers/db.js";
import {
  connectSocket,
  expectNoEvent,
  joinProject,
  joinProjectAck,
  startSocketServer,
  stopSocketServer,
  waitForConnect,
  waitForEvent,
} from "../helpers/socket.js";

const app = createApp();

beforeEach(resetDb);
afterEach(stopSocketServer);
afterAll(closeTestPool);

async function createProject(cookies: string, name: string) {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Cookie", cookies)
    .send({ name });
  expect(response.status).toBe(201);
  return response.body.data.project as { id: string };
}

async function addMember(cookies: string, projectId: string, email: string) {
  const response = await request(app)
    .post(`/api/v1/projects/${projectId}/members`)
    .set("Cookie", cookies)
    .send({ email });
  expect(response.status).toBe(201);
}

async function connectedSocket(url: string, session: TestSession) {
  const socket = connectSocket(url, session.cookies);
  await waitForConnect(socket);
  return socket;
}

async function waitForPresenceCleanup(
  projectIds: string[],
  timeoutMs = 2_000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (projectIds.every((id) => getOnlineUserIds(id).length === 0)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Presence was not cleaned up");
}

/** Ignores stale broadcasts and resolves on the first matching update. */
function waitForPresence(
  socket: Awaited<ReturnType<typeof connectedSocket>>,
  projectId: string,
  expectedIds: string[],
  timeoutMs = 2_000,
): Promise<string[]> {
  const expected = [...expectedIds].sort();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for matching presence"));
    }, timeoutMs);
    const handler = (payload: {
      projectId: string;
      onlineUserIds: string[];
    }) => {
      if (payload.projectId !== projectId) return;
      if (
        JSON.stringify([...payload.onlineUserIds].sort()) !==
        JSON.stringify(expected)
      ) {
        return;
      }
      cleanup();
      resolve(payload.onlineUserIds);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("presence:update", handler);
    };
    socket.on("presence:update", handler);
  });
}

describe("project rooms and presence", () => {
  it("acknowledges a member join with the online user list", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const project = await createProject(maya.cookies, "Alpha");
    const socket = await connectedSocket(url, maya);

    const ack = await joinProject(socket, project.id);

    expect(ack).toEqual({ ok: true, onlineUserIds: [maya.user.id] });
  });

  it("rejects a non-member with NOT_FOUND and leaves no presence", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies, "Alpha");
    const socket = await connectedSocket(url, dev);

    const ack = await joinProjectAck(socket, project.id);

    expect(ack).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(getOnlineUserIds(project.id)).toEqual([]);
  });

  it("rejects a malformed project id", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const socket = await connectedSocket(url, maya);

    const ack = await joinProjectAck(socket, "not-a-uuid");

    expect(ack).toEqual({ ok: false, code: "INVALID_PAYLOAD" });
  });

  it("does not duplicate presence when joining twice from one socket", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const project = await createProject(maya.cookies, "Alpha");
    const socket = await connectedSocket(url, maya);

    const first = await joinProject(socket, project.id);
    const second = await joinProject(socket, project.id);

    expect(first.onlineUserIds).toEqual([maya.user.id]);
    expect(second.onlineUserIds).toEqual([maya.user.id]);
    expect(getOnlineUserIds(project.id)).toEqual([maya.user.id]);
  });

  it("broadcasts presence to both users after the second join", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies, "Alpha");
    await addMember(maya.cookies, project.id, "dev@example.com");

    const mayaSocket = await connectedSocket(url, maya);
    const devSocket = await connectedSocket(url, dev);
    await joinProject(mayaSocket, project.id);

    const mayaUpdate = waitForEvent(mayaSocket, "presence:update");
    const devUpdate = waitForEvent(devSocket, "presence:update");
    await joinProject(devSocket, project.id);

    const expected = [maya.user.id, dev.user.id].sort();
    expect((await mayaUpdate).onlineUserIds.sort()).toEqual(expected);
    expect((await devUpdate).onlineUserIds.sort()).toEqual(expected);
  });

  it("keeps a user online until their last tab disconnects", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies, "Alpha");
    await addMember(maya.cookies, project.id, "dev@example.com");

    const mayaSocket = await connectedSocket(url, maya);
    const devTabOne = await connectedSocket(url, dev);
    const devTabTwo = await connectedSocket(url, dev);
    await joinProject(mayaSocket, project.id);
    await joinProject(devTabOne, project.id);
    await joinProject(devTabTwo, project.id);

    const afterFirst = waitForPresence(mayaSocket, project.id, [
      maya.user.id,
      dev.user.id,
    ]);
    devTabOne.disconnect();
    expect(await afterFirst).toContain(dev.user.id);

    const afterLast = waitForPresence(mayaSocket, project.id, [maya.user.id]);
    devTabTwo.disconnect();
    expect(await afterLast).toEqual([maya.user.id]);
    expect(getOnlineUserIds(project.id)).toEqual([maya.user.id]);
  });

  it("removes presence immediately on project:leave", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies, "Alpha");
    await addMember(maya.cookies, project.id, "dev@example.com");

    const mayaSocket = await connectedSocket(url, maya);
    const devSocket = await connectedSocket(url, dev);
    await joinProject(mayaSocket, project.id);
    await joinProject(devSocket, project.id);

    const update = waitForPresence(mayaSocket, project.id, [maya.user.id]);
    const ack = await new Promise<{ ok: true }>((resolve) => {
      devSocket.emit("project:leave", { projectId: project.id }, resolve);
    });

    expect(ack).toEqual({ ok: true });
    expect(await update).toEqual([maya.user.id]);
    expect(getOnlineUserIds(project.id)).toEqual([maya.user.id]);
  });

  it("cleans every joined project on disconnect without leave", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const first = await createProject(maya.cookies, "Alpha");
    const second = await createProject(maya.cookies, "Beta");
    await addMember(maya.cookies, first.id, "dev@example.com");
    await addMember(maya.cookies, second.id, "dev@example.com");

    const devSocket = await connectedSocket(url, dev);
    await joinProject(devSocket, first.id);
    await joinProject(devSocket, second.id);
    expect(getOnlineUserIds(first.id)).toEqual([dev.user.id]);
    expect(getOnlineUserIds(second.id)).toEqual([dev.user.id]);

    devSocket.disconnect();
    await waitForPresenceCleanup([first.id, second.id]);
  });

  it("does not deliver another project's presence updates", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const alpha = await createProject(maya.cookies, "Alpha");
    const beta = await createProject(maya.cookies, "Beta");
    await addMember(maya.cookies, alpha.id, "sam@example.com");
    await addMember(maya.cookies, beta.id, "dev@example.com");

    const devSocket = await connectedSocket(url, dev);
    const samSocket = await connectedSocket(url, sam);
    await joinProject(devSocket, beta.id);

    const noUpdate = expectNoEvent(devSocket, "presence:update", 300);
    await joinProject(samSocket, alpha.id);
    await noUpdate;
  });
});
