import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import {
  boardColumns,
  comments,
  notifications,
  projectMembers,
  projects,
  tasks,
} from "../../src/db/schema/index.js";
import { registerSession } from "../helpers/auth.js";
import { closeTestPool, resetDb } from "../helpers/db.js";
import { createTestUser } from "../helpers/fixtures.js";

const app = createApp();

beforeEach(resetDb);
afterAll(closeTestPool);

async function setup() {
  const maya = await createTestUser("Maya Chen", "maya@example.com");
  const dev = await createTestUser("Dev Patel", "dev@example.com");
  const sam = await createTestUser("Sam Rivera", "sam@example.com");

  const [project] = await db
    .insert(projects)
    .values({ name: "Alpha", ownerId: maya.id })
    .returning();
  await db.insert(projectMembers).values([
    { projectId: project.id, userId: maya.id, role: "owner" },
    { projectId: project.id, userId: dev.id, role: "member" },
  ]);
  const columns = await db
    .insert(boardColumns)
    .values([
      { projectId: project.id, name: "Backlog", position: 1024 },
      { projectId: project.id, name: "Done", position: 2048 },
    ])
    .returning();
  const [task] = await db
    .insert(tasks)
    .values({
      projectId: project.id,
      columnId: columns[0].id,
      title: "Audit task",
      createdBy: maya.id,
      assigneeId: dev.id,
      position: 1024,
    })
    .returning();
  const [comment] = await db
    .insert(comments)
    .values({ taskId: task.id, authorId: maya.id, body: "Audit comment" })
    .returning();
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: maya.id,
      actorId: dev.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: task.id,
    })
    .returning();

  return { maya, dev, sam, project, columns, task, comment, notification };
}

type Method = "get" | "post" | "patch" | "delete";

function send(method: Method, path: string, cookies?: string, body?: unknown) {
  let req = request(app)[method](path);
  if (cookies) req = req.set("Cookie", cookies);
  if (body !== undefined) req = req.send(body as object);
  return req;
}

describe("anonymous access", () => {
  it("rejects every protected route with 401", async () => {
    const { project, columns, task, comment, notification, dev } =
      await setup();
    const routes: [Method, string, unknown?][] = [
      ["get", "/api/v1/auth/me"],
      ["get", "/api/v1/users"],
      ["patch", "/api/v1/users/me", { name: "X" }],
      ["get", "/api/v1/projects"],
      ["post", "/api/v1/projects", { name: "New" }],
      ["get", `/api/v1/projects/${project.id}`],
      ["patch", `/api/v1/projects/${project.id}`, { name: "X" }],
      ["delete", `/api/v1/projects/${project.id}`],
      ["get", `/api/v1/projects/${project.id}/members`],
      ["post", `/api/v1/projects/${project.id}/members`, {}],
      [
        "patch",
        `/api/v1/projects/${project.id}/members/${dev.id}`,
        { role: "admin" },
      ],
      ["delete", `/api/v1/projects/${project.id}/members/${dev.id}`],
      ["post", `/api/v1/projects/${project.id}/columns`, { name: "X" }],
      [
        "patch",
        `/api/v1/projects/${project.id}/columns/reorder`,
        { columnIds: [] },
      ],
      ["patch", `/api/v1/columns/${columns[0].id}`, { name: "X" }],
      ["delete", `/api/v1/columns/${columns[0].id}`],
      ["get", `/api/v1/projects/${project.id}/tasks`],
      ["post", `/api/v1/projects/${project.id}/tasks`, {}],
      ["get", `/api/v1/tasks/${task.id}`],
      ["patch", `/api/v1/tasks/${task.id}`, { title: "X" }],
      ["patch", `/api/v1/tasks/${task.id}/move`, {}],
      ["delete", `/api/v1/tasks/${task.id}`],
      ["get", `/api/v1/tasks/${task.id}/comments`],
      ["post", `/api/v1/tasks/${task.id}/comments`, { body: "X" }],
      ["patch", `/api/v1/comments/${comment.id}`, { body: "X" }],
      ["delete", `/api/v1/comments/${comment.id}`],
      ["get", "/api/v1/notifications"],
      ["get", "/api/v1/notifications/unread-count"],
      ["patch", `/api/v1/notifications/${notification.id}/read`],
      ["post", "/api/v1/notifications/read-all"],
    ];

    for (const [method, path, body] of routes) {
      const response = await send(method, path, undefined, body);
      expect([method, path, response.status]).toEqual([method, path, 401]);
    }
  });
});

describe("invalid path identifiers", () => {
  it("returns 422 instead of 500 for malformed UUIDs", async () => {
    const { maya, project, columns, task, comment, notification, dev } =
      await setup();
    const routes: [Method, string, unknown?][] = [
      ["get", "/api/v1/projects/not-a-uuid"],
      ["patch", "/api/v1/projects/not-a-uuid", { name: "X" }],
      ["delete", "/api/v1/projects/not-a-uuid"],
      ["get", "/api/v1/projects/not-a-uuid/members"],
      ["post", "/api/v1/projects/not-a-uuid/members", {}],
      ["post", "/api/v1/projects/not-a-uuid/columns", { name: "X" }],
      [
        "patch",
        `/api/v1/projects/${project.id}/columns/reorder`,
        { columnIds: "nope" },
      ],
      ["patch", "/api/v1/columns/not-a-uuid", { name: "X" }],
      ["delete", "/api/v1/columns/not-a-uuid"],
      ["get", "/api/v1/projects/not-a-uuid/tasks"],
      ["post", "/api/v1/projects/not-a-uuid/tasks", {}],
      ["get", "/api/v1/tasks/not-a-uuid"],
      ["patch", "/api/v1/tasks/not-a-uuid", { title: "X" }],
      ["patch", "/api/v1/tasks/not-a-uuid/move", {}],
      ["delete", "/api/v1/tasks/not-a-uuid"],
      ["get", "/api/v1/tasks/not-a-uuid/comments"],
      ["post", "/api/v1/tasks/not-a-uuid/comments", { body: "X" }],
      ["patch", "/api/v1/comments/not-a-uuid", { body: "X" }],
      ["delete", "/api/v1/comments/not-a-uuid"],
      ["patch", "/api/v1/notifications/not-a-uuid/read"],
      [
        "patch",
        `/api/v1/projects/${project.id}/members/not-a-uuid`,
        { role: "admin" },
      ],
    ];

    for (const [method, path, body] of routes) {
      const response = await send(method, path, maya.cookies, body);
      expect([method, path, response.status]).toEqual([method, path, 422]);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }

    // Ensure the valid fixtures were not consumed by the invalid cases.
    expect(columns).toHaveLength(2);
    expect(task.id).toBeTruthy();
    expect(comment.id).toBeTruthy();
    expect(notification.id).toBeTruthy();
    expect(dev.id).toBeTruthy();
  });
});

describe("non-member access", () => {
  it("hides project-scoped resources with 404 codes", async () => {
    const { sam, project, columns, task, comment, notification, maya } =
      await setup();
    const cases: [Method, string, string, unknown?][] = [
      ["get", `/api/v1/projects/${project.id}`, "PROJECT_NOT_FOUND"],
      [
        "patch",
        `/api/v1/projects/${project.id}`,
        "PROJECT_NOT_FOUND",
        { name: "X" },
      ],
      ["delete", `/api/v1/projects/${project.id}`, "PROJECT_NOT_FOUND"],
      ["get", `/api/v1/projects/${project.id}/members`, "PROJECT_NOT_FOUND"],
      [
        "post",
        `/api/v1/projects/${project.id}/members`,
        "PROJECT_NOT_FOUND",
        { email: "dev@example.com" },
      ],
      [
        "post",
        `/api/v1/projects/${project.id}/columns`,
        "PROJECT_NOT_FOUND",
        { name: "X" },
      ],
      [
        "patch",
        `/api/v1/projects/${project.id}/columns/reorder`,
        "PROJECT_NOT_FOUND",
        { columnIds: [columns[0].id, columns[1].id] },
      ],
      [
        "patch",
        `/api/v1/columns/${columns[0].id}`,
        "COLUMN_NOT_FOUND",
        { name: "X" },
      ],
      ["delete", `/api/v1/columns/${columns[0].id}`, "COLUMN_NOT_FOUND"],
      ["get", `/api/v1/projects/${project.id}/tasks`, "PROJECT_NOT_FOUND"],
      [
        "post",
        `/api/v1/projects/${project.id}/tasks`,
        "PROJECT_NOT_FOUND",
        { columnId: columns[0].id, title: "X" },
      ],
      ["get", `/api/v1/tasks/${task.id}`, "TASK_NOT_FOUND"],
      ["patch", `/api/v1/tasks/${task.id}`, "TASK_NOT_FOUND", { title: "X" }],
      [
        "patch",
        `/api/v1/tasks/${task.id}/move`,
        "TASK_NOT_FOUND",
        { columnId: columns[1].id },
      ],
      ["delete", `/api/v1/tasks/${task.id}`, "TASK_NOT_FOUND"],
      ["get", `/api/v1/tasks/${task.id}/comments`, "TASK_NOT_FOUND"],
      [
        "post",
        `/api/v1/tasks/${task.id}/comments`,
        "TASK_NOT_FOUND",
        { body: "X" },
      ],
      [
        "patch",
        `/api/v1/comments/${comment.id}`,
        "COMMENT_NOT_FOUND",
        { body: "X" },
      ],
      ["delete", `/api/v1/comments/${comment.id}`, "COMMENT_NOT_FOUND"],
      [
        "patch",
        `/api/v1/notifications/${notification.id}/read`,
        "NOTIFICATION_NOT_FOUND",
      ],
    ];

    for (const [method, path, code, body] of cases) {
      const response = await send(method, path, sam.cookies, body);
      expect([method, path, response.status]).toEqual([method, path, 404]);
      expect(response.body.error.code).toBe(code);
    }

    // Personal notification routes still work for a user with no projects.
    expect(
      (await send("get", "/api/v1/notifications", sam.cookies)).status,
    ).toBe(200);
    expect(
      (await send("get", "/api/v1/notifications/unread-count", sam.cookies))
        .status,
    ).toBe(200);
    expect(
      (await send("post", "/api/v1/notifications/read-all", sam.cookies))
        .status,
    ).toBe(200);

    // The owner still sees everything after the outsider probes.
    expect(
      (await send("get", `/api/v1/tasks/${task.id}`, maya.cookies)).status,
    ).toBe(200);
  });
});

describe("security regressions", () => {
  it("returns the same response for an unknown email and a wrong password", async () => {
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    expect(dev.user.email).toBe("dev@example.com");

    const unknown = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "Password123!" });
    const wrong = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "dev@example.com", password: "WrongPassword!" });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("never returns password hashes or secrets, and sets hardened cookies", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Maya",
      email: "maya@example.com",
      password: "Password123!",
    });
    expect(response.status).toBe(201);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("passwordHash");
    expect(body).not.toContain("Password123!");
    expect(body).not.toContain("ca_refresh");
    expect(body).not.toContain(process.env.JWT_SECRET ?? "JWT_SECRET");

    const cookies = response.headers["set-cookie"] as unknown as string[];
    const access = cookies.find((cookie) => cookie.startsWith("ca_access="));
    const refresh = cookies.find((cookie) => cookie.startsWith("ca_refresh="));
    expect(access).toBeDefined();
    expect(refresh).toBeDefined();
    for (const cookie of [access, refresh]) {
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
    }
    expect(access).toContain("Path=/;");
    expect(refresh).toContain("Path=/api/v1/auth;");
    if (process.env.COOKIE_SECURE !== "true") {
      expect(access).not.toContain("Secure");
      expect(refresh).not.toContain("Secure");
    }

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookies.map((cookie) => cookie.split(";")[0]).join("; "));
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toContain("passwordHash");
  });

  it("rejects a foreign origin and allows the configured one", async () => {
    const maya = await createTestUser("Maya Chen", "maya@example.com");

    const foreign = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", maya.cookies)
      .set("Origin", "https://evil.example")
      .send({ name: "Cross site" });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.code).toBe("FORBIDDEN_ORIGIN");

    const allowed = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", maya.cookies)
      .set("Origin", "http://localhost:5173")
      .send({ name: "Same site" });
    expect(allowed.status).toBe(201);
  });

  it("throttles auth endpoints per IP", async () => {
    const limited = createApp({ enableRateLimit: true });
    let lastStatus = 0;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await request(limited)
        .post("/api/v1/auth/login")
        .send({ email: "nobody@example.com", password: "Password123!" });
      lastStatus = response.status;
    }
    expect(lastStatus).toBe(429);

    const response = await request(limited)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "Password123!" });
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("RATE_LIMITED");
  });

  it("shares one 60/min user write bucket across tasks and comments", async () => {
    const limited = createApp({ enableRateLimit: true });
    const maya = await createTestUser("Maya Chen", "maya@example.com");
    const dev = await createTestUser("Dev Patel", "dev@example.com");
    const [project] = await db
      .insert(projects)
      .values({ name: "Throttle", ownerId: maya.id })
      .returning();
    await db.insert(projectMembers).values([
      { projectId: project.id, userId: maya.id, role: "owner" },
      { projectId: project.id, userId: dev.id, role: "member" },
    ]);
    const [column] = await db
      .insert(boardColumns)
      .values({ projectId: project.id, name: "Backlog", position: 1024 })
      .returning();

    for (let index = 0; index < 60; index += 1) {
      const response = await request(limited)
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set("Cookie", maya.cookies)
        .send({ columnId: column.id, title: `Task ${index}` });
      expect(response.status).toBe(201);
    }

    const limitedTask = await request(limited)
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set("Cookie", maya.cookies)
      .send({ columnId: column.id, title: "One too many" });
    expect(limitedTask.status).toBe(429);
    expect(limitedTask.body.error.code).toBe("RATE_LIMITED");

    const task = (
      await db
        .insert(tasks)
        .values({
          projectId: project.id,
          columnId: column.id,
          title: "Comment target",
          createdBy: maya.id,
          position: 1024,
        })
        .returning()
    )[0];
    const limitedComment = await request(limited)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set("Cookie", maya.cookies)
      .send({ body: "Same bucket" });
    expect(limitedComment.status).toBe(429);

    const otherUser = await request(limited)
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set("Cookie", dev.cookies)
      .send({ columnId: column.id, title: "Another user" });
    expect(otherUser.status).toBe(201);
  });

  it("returns JSON envelopes for malformed and oversized bodies", async () => {
    const maya = await createTestUser("Maya Chen", "maya@example.com");

    const malformed = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", maya.cookies)
      .set("Content-Type", "application/json")
      .send('{"name":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("MALFORMED_JSON");

    const oversized = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", maya.cookies)
      .send({ name: "x".repeat(1_100_000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("round-trips script tags as text and parameterizes search", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const payload = "<script>alert(1)</script>";

    const project = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", maya.cookies)
      .send({ name: payload });
    expect(project.status).toBe(201);
    expect(project.body.data.project.name).toBe(payload);

    const columnId = project.body.data.project.columns[0].id as string;
    const task = await request(app)
      .post(`/api/v1/projects/${project.body.data.project.id}/tasks`)
      .set("Cookie", maya.cookies)
      .send({ columnId, title: "XSS target" });
    const comment = await request(app)
      .post(`/api/v1/tasks/${task.body.data.task.id}/comments`)
      .set("Cookie", maya.cookies)
      .send({ body: payload });
    expect(comment.status).toBe(201);
    expect(comment.body.data.comment.body).toBe(payload);

    const fetched = await request(app)
      .get(`/api/v1/tasks/${task.body.data.task.id}/comments`)
      .set("Cookie", maya.cookies);
    expect(fetched.body.data.comments[0].body).toBe(payload);

    const attack = "' OR 1=1 --";
    const search = await request(app)
      .get(`/api/v1/users?search=${encodeURIComponent(attack)}`)
      .set("Cookie", maya.cookies);
    expect(search.status).toBe(200);
    expect(search.body.data.users).toEqual([]);
  });
});
