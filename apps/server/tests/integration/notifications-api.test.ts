import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import {
  comments,
  notifications,
  projectMembers,
  tasks,
  type InsertNotification,
} from "../../src/db/schema/index.js";
import { registerSession } from "../helpers/auth.js";
import { closeTestPool, resetDb } from "../helpers/db.js";

const app = createApp();
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

beforeEach(resetDb);
afterAll(closeTestPool);

async function createProject(cookies: string, name = "Alpha") {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Cookie", cookies)
    .send({ name });
  expect(response.status).toBe(201);
  return response.body.data.project as {
    id: string;
    columns: { id: string }[];
  };
}

async function setup() {
  const maya = await registerSession(app, "maya@example.com", "Maya Chen");
  const dev = await registerSession(app, "dev@example.com", "Dev Patel");
  const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
  const project = await createProject(maya.cookies);
  await db
    .insert(projectMembers)
    .values({ projectId: project.id, userId: dev.user.id, role: "member" });

  const [task] = await db
    .insert(tasks)
    .values({
      projectId: project.id,
      columnId: project.columns[0].id,
      title: "Build the new design tokens",
      createdBy: maya.user.id,
      assigneeId: dev.user.id,
      position: 1024,
    })
    .returning();

  const [comment] = await db
    .insert(comments)
    .values({
      taskId: task.id,
      authorId: maya.user.id,
      body: "C".repeat(150),
    })
    .returning();

  return { maya, dev, sam, project, task, comment };
}

async function insertNotification(input: Omit<InsertNotification, "id">) {
  const [row] = await db.insert(notifications).values(input).returning();
  return row;
}

function listNotifications(cookies: string, query = "") {
  return request(app)
    .get(`/api/v1/notifications${query}`)
    .set("Cookie", cookies);
}

function unreadCount(cookies: string) {
  return request(app)
    .get("/api/v1/notifications/unread-count")
    .set("Cookie", cookies);
}

function markRead(cookies: string, id: string) {
  return request(app)
    .patch(`/api/v1/notifications/${id}/read`)
    .set("Cookie", cookies);
}

function markAllRead(cookies: string) {
  return request(app)
    .post("/api/v1/notifications/read-all")
    .set("Cookie", cookies);
}

describe("GET /notifications", () => {
  it("returns newest first with joined actor, project, task, and excerpt", async () => {
    const { maya, dev, project, task, comment } = await setup();
    const older = await insertNotification({
      userId: dev.user.id,
      actorId: maya.user.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: task.id,
      createdAt: new Date("2026-11-01T09:00:00.000Z"),
    });
    const newer = await insertNotification({
      userId: dev.user.id,
      actorId: maya.user.id,
      type: "comment_added",
      projectId: project.id,
      taskId: task.id,
      commentId: comment.id,
      createdAt: new Date("2026-11-02T09:00:00.000Z"),
      readAt: new Date("2026-11-02T10:00:00.000Z"),
    });

    const response = await listNotifications(dev.cookies);

    expect(response.status).toBe(200);
    const { items } = response.body.data as {
      items: {
        id: string;
        type: string;
        actor: { name: string };
        project: { id: string; name: string };
        task: { id: string; title: string } | null;
        commentExcerpt: string | null;
        readAt: string | null;
        createdAt: string;
      }[];
    };
    expect(items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(items[0]).toMatchObject({
      type: "comment_added",
      actor: { name: "Maya Chen" },
      project: { id: project.id, name: "Alpha" },
      task: { id: task.id, title: "Build the new design tokens" },
      commentExcerpt: "C".repeat(120),
      readAt: "2026-11-02T10:00:00.000Z",
    });
    expect(items[1]).toMatchObject({
      type: "task_assigned",
      commentExcerpt: null,
      readAt: null,
    });
  });

  it("includes the unread count matching unread rows", async () => {
    const { maya, dev, project, task } = await setup();
    await insertNotification({
      userId: dev.user.id,
      actorId: maya.user.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: task.id,
    });
    await insertNotification({
      userId: dev.user.id,
      actorId: maya.user.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: task.id,
      readAt: new Date(),
    });

    const list = await listNotifications(dev.cookies);
    expect(list.body.data.unreadCount).toBe(1);

    const count = await unreadCount(dev.cookies);
    expect(count.status).toBe(200);
    expect(count.body.data.count).toBe(1);
  });

  it("defaults the limit to 10 and validates the range", async () => {
    const { maya, dev, project, task } = await setup();
    await db.insert(notifications).values(
      Array.from({ length: 12 }, (_, index) => ({
        userId: dev.user.id,
        actorId: maya.user.id,
        type: "task_assigned" as const,
        projectId: project.id,
        taskId: task.id,
        createdAt: new Date(Date.UTC(2026, 10, 2, 10, 0, index)),
      })),
    );

    const page = await listNotifications(dev.cookies);
    expect(page.status).toBe(200);
    expect(page.body.data.items).toHaveLength(10);

    for (const limit of ["0", "51", "abc", "-1"]) {
      const response = await listNotifications(dev.cookies, `?limit=${limit}`);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    for (const limit of ["1", "50"]) {
      const response = await listNotifications(dev.cookies, `?limit=${limit}`);
      expect(response.status).toBe(200);
    }
  });

  it("paginates 25 rows without duplicates or omissions", async () => {
    const { maya, dev, project, task } = await setup();
    const base = Date.UTC(2026, 10, 1, 0, 0, 0);
    const inserted = await db
      .insert(notifications)
      .values(
        Array.from({ length: 25 }, (_, index) => ({
          userId: dev.user.id,
          actorId: maya.user.id,
          type: "task_assigned" as const,
          projectId: project.id,
          taskId: task.id,
          createdAt: new Date(base + index * 1000),
        })),
      )
      .returning({ id: notifications.id });

    const collected: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query = cursor
        ? `?limit=10&cursor=${encodeURIComponent(cursor)}`
        : "?limit=10";
      const response = await listNotifications(dev.cookies, query);
      expect(response.status).toBe(200);
      collected.push(
        ...(response.body.data.items as { id: string }[]).map(
          (item) => item.id,
        ),
      );
      cursor = response.body.data.nextCursor as string | null;
      pages += 1;
      expect(pages).toBeLessThanOrEqual(4);
    } while (cursor);

    expect(pages).toBe(3);
    expect(new Set(collected).size).toBe(25);
    expect(collected).toEqual(inserted.map((row) => row.id).reverse());
  });

  it("pages rows sharing a timestamp with the id tiebreaker", async () => {
    const { maya, dev, project, task } = await setup();
    const sameTime = new Date("2026-11-02T10:00:00.000Z");
    const inserted = await db
      .insert(notifications)
      .values(
        Array.from({ length: 3 }, () => ({
          userId: dev.user.id,
          actorId: maya.user.id,
          type: "task_assigned" as const,
          projectId: project.id,
          taskId: task.id,
          createdAt: sameTime,
        })),
      )
      .returning({ id: notifications.id });

    const collected: string[] = [];
    let cursor: string | null = null;
    do {
      const query = cursor
        ? `?limit=1&cursor=${encodeURIComponent(cursor)}`
        : "?limit=1";
      const response = await listNotifications(dev.cookies, query);
      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
      collected.push(response.body.data.items[0].id);
      cursor = response.body.data.nextCursor;
    } while (cursor);

    const expected = inserted
      .map((row) => row.id)
      .sort()
      .reverse();
    expect(collected).toEqual(expected);
  });

  it("rejects a tampered cursor with 422 INVALID_CURSOR", async () => {
    const { dev } = await setup();

    for (const cursor of ["garbage", "e30", "xyz123"]) {
      const response = await listNotifications(
        dev.cookies,
        `?cursor=${encodeURIComponent(cursor)}`,
      );
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("INVALID_CURSOR");
    }
  });

  it("only lists the caller's notifications", async () => {
    const { maya, dev, project, task } = await setup();
    await insertNotification({
      userId: dev.user.id,
      actorId: maya.user.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: task.id,
    });

    const response = await listNotifications(maya.cookies);
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});

describe("PATCH /notifications/:id/read", () => {
  it("marks a notification read and stays idempotent", async () => {
    const { maya, dev, project, task } = await setup();
    const notification = await insertNotification({
      userId: dev.user.id,
      actorId: maya.user.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: task.id,
    });

    const first = await markRead(dev.cookies, notification.id);
    expect(first.status).toBe(200);
    const firstReadAt = first.body.data.notification.readAt as string;
    expect(firstReadAt).toBeTruthy();

    expect((await unreadCount(dev.cookies)).body.data.count).toBe(0);

    const second = await markRead(dev.cookies, notification.id);
    expect(second.status).toBe(200);
    expect(second.body.data.notification.readAt).toBe(firstReadAt);
  });

  it("returns 404 for another user's notification and a missing id", async () => {
    const { maya, dev, project, task } = await setup();
    const notification = await insertNotification({
      userId: dev.user.id,
      actorId: maya.user.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: task.id,
    });

    const foreign = await markRead(maya.cookies, notification.id);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe("NOTIFICATION_NOT_FOUND");

    const missing = await markRead(maya.cookies, MISSING_ID);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOTIFICATION_NOT_FOUND");
  });
});

describe("POST /notifications/read-all", () => {
  it("marks only the caller's unread rows and returns the exact count", async () => {
    const { maya, dev, sam, project, task } = await setup();
    await db.insert(notifications).values([
      {
        userId: dev.user.id,
        actorId: maya.user.id,
        type: "task_assigned",
        projectId: project.id,
        taskId: task.id,
      },
      {
        userId: dev.user.id,
        actorId: maya.user.id,
        type: "task_assigned",
        projectId: project.id,
        taskId: task.id,
      },
      {
        userId: dev.user.id,
        actorId: maya.user.id,
        type: "task_assigned",
        projectId: project.id,
        taskId: task.id,
        readAt: new Date(),
      },
      {
        userId: sam.user.id,
        actorId: maya.user.id,
        type: "task_assigned",
        projectId: project.id,
        taskId: task.id,
      },
    ]);

    const response = await markAllRead(dev.cookies);
    expect(response.status).toBe(200);
    expect(response.body.data.updated).toBe(2);
    expect((await unreadCount(dev.cookies)).body.data.count).toBe(0);
    expect((await unreadCount(sam.cookies)).body.data.count).toBe(1);

    const second = await markAllRead(dev.cookies);
    expect(second.status).toBe(200);
    expect(second.body.data.updated).toBe(0);
  });
});

describe("notification API access and cascades", () => {
  it("returns 401 for anonymous requests to all four endpoints", async () => {
    const list = await request(app).get("/api/v1/notifications");
    expect(list.status).toBe(401);

    const count = await request(app).get("/api/v1/notifications/unread-count");
    expect(count.status).toBe(401);

    const read = await request(app).patch(
      `/api/v1/notifications/${MISSING_ID}/read`,
    );
    expect(read.status).toBe(401);

    const readAll = await request(app).post("/api/v1/notifications/read-all");
    expect(readAll.status).toBe(401);
  });

  it("removes notifications when the project is deleted", async () => {
    const { maya, dev, project, task } = await setup();
    await insertNotification({
      userId: dev.user.id,
      actorId: maya.user.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: task.id,
    });

    await request(app)
      .delete(`/api/v1/projects/${project.id}`)
      .set("Cookie", maya.cookies)
      .expect(204);

    const response = await listNotifications(dev.cookies);
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});
