import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { getOnlineUserIds } from "../../src/realtime/presence.js";
import type { TestSession } from "../helpers/auth.js";
import { registerSession } from "../helpers/auth.js";
import { closeTestPool, resetDb } from "../helpers/db.js";
import {
  connectSocket,
  expectNoEvent,
  joinProject,
  joinProjectAck,
  startSocketServer,
  stopSocketServer,
  waitForConnect,
  waitForConnectError,
  waitForEvent,
  type TestSocket,
} from "../helpers/socket.js";

const app = createApp();

beforeEach(resetDb);
afterEach(stopSocketServer);
afterAll(closeTestPool);

interface ProjectFixture {
  id: string;
  columns: { id: string; name: string }[];
}

async function createProject(
  cookies: string,
  name = "Alpha",
): Promise<ProjectFixture> {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Cookie", cookies)
    .send({ name });
  expect(response.status).toBe(201);
  return response.body.data.project;
}

async function addMember(cookies: string, projectId: string, email: string) {
  const response = await request(app)
    .post(`/api/v1/projects/${projectId}/members`)
    .set("Cookie", cookies)
    .send({ email });
  expect(response.status).toBe(201);
}

async function createTask(
  cookies: string,
  project: ProjectFixture,
  body: Record<string, unknown> = {},
) {
  const response = await request(app)
    .post(`/api/v1/projects/${project.id}/tasks`)
    .set("Cookie", cookies)
    .send({
      columnId: project.columns[0].id,
      title: "Realtime task",
      ...body,
    });
  expect(response.status).toBe(201);
  return response.body.data.task as {
    id: string;
    columnId: string;
    projectId: string;
    title: string;
  };
}

async function connectedSocket(
  url: string,
  session: TestSession,
  projectId?: string,
): Promise<TestSocket> {
  const socket = connectSocket(url, session.cookies);
  await waitForConnect(socket);
  if (projectId) await joinProject(socket, projectId);
  return socket;
}

async function setup(options: { withSam?: boolean } = {}) {
  const maya = await registerSession(app, "maya@example.com", "Maya Chen");
  const dev = await registerSession(app, "dev@example.com", "Dev Patel");
  const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
  const project = await createProject(maya.cookies, "Alpha");
  await addMember(maya.cookies, project.id, "dev@example.com");
  if (options.withSam) {
    await addMember(maya.cookies, project.id, "sam@example.com");
  }
  return { maya, dev, sam, project };
}

describe("project room events", () => {
  it("emits task:created with a full card including commentCount", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const socket = await connectedSocket(url, dev, project.id);

    const created = waitForEvent(socket, "task:created");
    await createTask(maya.cookies, project);
    const payload = await created;

    expect(payload.task).toMatchObject({
      projectId: project.id,
      columnId: project.columns[0].id,
      title: "Realtime task",
      commentCount: 0,
      assignee: null,
    });
    expect(payload.task).not.toHaveProperty("description");
  });

  it("emits task:updated after a title change", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const task = await createTask(maya.cookies, project);
    const socket = await connectedSocket(url, dev, project.id);

    const updated = waitForEvent(socket, "task:updated");
    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set("Cookie", maya.cookies)
      .send({ title: "Renamed in realtime" })
      .expect(200);
    const payload = await updated;

    expect(payload.task).toMatchObject({
      id: task.id,
      title: "Renamed in realtime",
    });
  });

  it("emits task:moved with the previous column", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const task = await createTask(maya.cookies, project);
    const socket = await connectedSocket(url, dev, project.id);

    const moved = waitForEvent(socket, "task:moved");
    await request(app)
      .patch(`/api/v1/tasks/${task.id}/move`)
      .set("Cookie", maya.cookies)
      .send({ columnId: project.columns[1].id })
      .expect(200);
    const payload = await moved;

    expect(payload.fromColumnId).toBe(project.columns[0].id);
    expect(payload.task).toMatchObject({
      id: task.id,
      columnId: project.columns[1].id,
    });
  });

  it("emits task:deleted with the task and column ids", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const task = await createTask(maya.cookies, project);
    const socket = await connectedSocket(url, dev, project.id);

    const deleted = waitForEvent(socket, "task:deleted");
    await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set("Cookie", maya.cookies)
      .expect(204);
    const payload = await deleted;

    expect(payload).toEqual({
      taskId: task.id,
      columnId: project.columns[0].id,
    });
  });

  it("emits the four column events with their payloads", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const socket = await connectedSocket(url, dev, project.id);

    const created = waitForEvent(socket, "column:created");
    const createResponse = await request(app)
      .post(`/api/v1/projects/${project.id}/columns`)
      .set("Cookie", maya.cookies)
      .send({ name: "Review" })
      .expect(201);
    const createdColumn = createResponse.body.data.column as {
      id: string;
      name: string;
    };
    expect((await created).column).toMatchObject({
      id: createdColumn.id,
      name: "Review",
    });

    const updated = waitForEvent(socket, "column:updated");
    await request(app)
      .patch(`/api/v1/columns/${createdColumn.id}`)
      .set("Cookie", maya.cookies)
      .send({ name: "QA" })
      .expect(200);
    expect((await updated).column.name).toBe("QA");

    const reordered = waitForEvent(socket, "columns:reordered");
    const order = [
      createdColumn.id,
      ...project.columns.map((column) => column.id),
    ];
    await request(app)
      .patch(`/api/v1/projects/${project.id}/columns/reorder`)
      .set("Cookie", maya.cookies)
      .send({ columnIds: order })
      .expect(200);
    const reorderedPayload = await reordered;
    expect(reorderedPayload.columns.map((column) => column.id)).toEqual(order);

    const deleted = waitForEvent(socket, "column:deleted");
    await request(app)
      .delete(`/api/v1/columns/${createdColumn.id}`)
      .set("Cookie", maya.cookies)
      .expect(204);
    expect(await deleted).toEqual({ columnId: createdColumn.id });
  });

  it("emits comment create, update, and delete", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const task = await createTask(maya.cookies, project);
    const socket = await connectedSocket(url, dev, project.id);

    const created = waitForEvent(socket, "comment:created");
    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set("Cookie", maya.cookies)
      .send({ body: "First comment" })
      .expect(201);
    const comment = response.body.data.comment as {
      id: string;
      body: string;
      author: { name: string };
    };
    const createdPayload = await created;
    expect(createdPayload.taskId).toBe(task.id);
    expect(createdPayload.comment).toMatchObject({
      id: comment.id,
      body: "First comment",
      author: { name: "Maya Chen" },
    });

    const updated = waitForEvent(socket, "comment:updated");
    await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set("Cookie", maya.cookies)
      .send({ body: "Edited comment" })
      .expect(200);
    expect((await updated).comment.body).toBe("Edited comment");

    const deleted = waitForEvent(socket, "comment:deleted");
    await request(app)
      .delete(`/api/v1/comments/${comment.id}`)
      .set("Cookie", maya.cookies)
      .expect(204);
    expect(await deleted).toEqual({
      taskId: task.id,
      commentId: comment.id,
    });
  });

  it("emits a role-independent project:updated summary", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const socket = await connectedSocket(url, dev, project.id);

    const updated = waitForEvent(socket, "project:updated");
    await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set("Cookie", maya.cookies)
      .send({ name: "Alpha Renamed" })
      .expect(200);
    const payload = await updated;

    expect(payload.project.name).toBe("Alpha Renamed");
    expect(payload.project).not.toHaveProperty("role");
  });

  it("emits member:added and member:updated", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, sam, project } = await setup();
    const socket = await connectedSocket(url, dev, project.id);

    const added = waitForEvent(socket, "member:added");
    await addMember(maya.cookies, project.id, "sam@example.com");
    const addedPayload = await added;
    expect(addedPayload.member).toMatchObject({
      userId: sam.user.id,
      name: "Sam Rivera",
      role: "member",
    });

    const updated = waitForEvent(socket, "member:updated");
    await request(app)
      .patch(`/api/v1/projects/${project.id}/members/${sam.user.id}`)
      .set("Cookie", maya.cookies)
      .send({ role: "admin" })
      .expect(200);
    expect((await updated).member).toMatchObject({
      userId: sam.user.id,
      role: "admin",
    });
  });
});

describe("membership and project teardown", () => {
  it("delivers member:removed to the project and personal rooms and revokes access", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const joinedSocket = await connectedSocket(url, dev, project.id);
    const personalSocket = await connectedSocket(url, dev);
    const mayaSocket = await connectedSocket(url, maya, project.id);

    const joinedEvent = waitForEvent(joinedSocket, "member:removed");
    const personalEvent = waitForEvent(personalSocket, "member:removed");
    const mayaEvent = waitForEvent(mayaSocket, "member:removed");

    await request(app)
      .delete(`/api/v1/projects/${project.id}/members/${dev.user.id}`)
      .set("Cookie", maya.cookies)
      .expect(204);

    const expected = { projectId: project.id, userId: dev.user.id };
    expect(await joinedEvent).toEqual(expected);
    expect(await personalEvent).toEqual(expected);
    expect(await mayaEvent).toEqual(expected);

    const rejoin = await joinProjectAck(joinedSocket, project.id);
    expect(rejoin).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(getOnlineUserIds(project.id)).toEqual([maya.user.id]);
  });

  it("delivers project:deleted to project and personal rooms and clears presence", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const joinedSocket = await connectedSocket(url, dev, project.id);
    const personalSocket = await connectedSocket(url, dev);
    const mayaSocket = await connectedSocket(url, maya, project.id);

    const joinedEvent = waitForEvent(joinedSocket, "project:deleted");
    const personalEvent = waitForEvent(personalSocket, "project:deleted");
    const mayaEvent = waitForEvent(mayaSocket, "project:deleted");

    await request(app)
      .delete(`/api/v1/projects/${project.id}`)
      .set("Cookie", maya.cookies)
      .expect(204);

    const expected = { projectId: project.id };
    expect(await joinedEvent).toEqual(expected);
    expect(await personalEvent).toEqual(expected);
    expect(await mayaEvent).toEqual(expected);

    const rejoin = await joinProjectAck(joinedSocket, project.id);
    expect(rejoin).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(getOnlineUserIds(project.id)).toEqual([]);
  });

  it("isolates project rooms from each other", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project: alpha } = await setup();
    const beta = await createProject(maya.cookies, "Beta");
    await addMember(maya.cookies, beta.id, "sam@example.com");

    const devSocket = await connectedSocket(url, dev, alpha.id);
    await connectedSocket(url, maya, beta.id);

    const noTask = expectNoEvent(devSocket, "task:created", 300);
    const noProject = expectNoEvent(devSocket, "project:updated", 300);
    await createTask(maya.cookies, beta, { title: "Beta only" });
    await request(app)
      .patch(`/api/v1/projects/${beta.id}`)
      .set("Cookie", maya.cookies)
      .send({ name: "Beta Renamed" })
      .expect(200);
    await noTask;
    await noProject;
  });

  it("emits no task:moved when the move is rejected", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const task = await createTask(maya.cookies, project);
    const socket = await connectedSocket(url, dev, project.id);

    const noMove = expectNoEvent(socket, "task:moved", 300);
    await request(app)
      .patch(`/api/v1/tasks/${task.id}/move`)
      .set("Cookie", maya.cookies)
      .send({ columnId: project.columns[0].id, beforeTaskId: task.id })
      .expect(422);
    await noMove;
  });
});

describe("notification delivery", () => {
  it("delivers notification:new only to the recipient and syncs read state", async () => {
    const { url } = await startSocketServer();
    const { maya, dev, project } = await setup();
    const joinedSocket = await connectedSocket(url, dev, project.id);
    const personalSocket = await connectedSocket(url, dev);
    const mayaSocket = await connectedSocket(url, maya, project.id);

    const joinedEvent = waitForEvent(joinedSocket, "notification:new");
    const personalEvent = waitForEvent(personalSocket, "notification:new");
    const mayaNoEvent = expectNoEvent(mayaSocket, "notification:new", 300);
    await createTask(maya.cookies, project, { assigneeId: dev.user.id });

    const joinedPayload = await joinedEvent;
    const personalPayload = await personalEvent;
    await mayaNoEvent;
    expect(joinedPayload.notification.type).toBe("task_assigned");
    expect(joinedPayload.notification.task?.title).toBe("Realtime task");
    expect(personalPayload.notification.id).toBe(joinedPayload.notification.id);

    const readJoined = waitForEvent(joinedSocket, "notification:read");
    const readPersonal = waitForEvent(personalSocket, "notification:read");
    await request(app)
      .patch(`/api/v1/notifications/${joinedPayload.notification.id}/read`)
      .set("Cookie", dev.cookies)
      .expect(200);
    for (const payload of await Promise.all([readJoined, readPersonal])) {
      expect(payload.notificationId).toBe(joinedPayload.notification.id);
      expect(payload.readAt).toBeTruthy();
    }

    await createTask(maya.cookies, project, {
      title: "Second assignment",
      assigneeId: dev.user.id,
    });
    const readAllJoined = waitForEvent(joinedSocket, "notifications:read-all");
    const readAllPersonal = waitForEvent(
      personalSocket,
      "notifications:read-all",
    );
    await request(app)
      .post("/api/v1/notifications/read-all")
      .set("Cookie", dev.cookies)
      .expect(200);
    for (const payload of await Promise.all([readAllJoined, readAllPersonal])) {
      expect(payload.readAt).toBeTruthy();
    }
  });

  it("rejects an expired access cookie at the handshake", async () => {
    const { url } = await startSocketServer();
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({ email: maya.user.email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(maya.user.id)
      .setIssuer("teamboard")
      .setAudience("teamboard-web")
      .setIssuedAt(now - 3_600)
      .setExpirationTime(now - 1_800)
      .sign(new TextEncoder().encode(env.JWT_SECRET));

    const socket = connectSocket(url, `ca_access=${expired}`);
    const error = await waitForConnectError(socket);

    expect(error.message).toBe("UNAUTHORIZED");
    expect(socket.connected).toBe(false);
  });
});
