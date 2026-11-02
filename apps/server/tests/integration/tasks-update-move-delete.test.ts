import { asc, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import { comments, projectMembers, tasks } from "../../src/db/schema/index.js";
import { registerSession } from "../helpers/auth.js";
import { closeTestPool, resetDb } from "../helpers/db.js";

const app = createApp();

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
    columns: { id: string; name: string }[];
  };
}

async function addMembership(
  projectId: string,
  userId: string,
  role: "owner" | "admin" | "member",
) {
  await db.insert(projectMembers).values({ projectId, userId, role });
}

async function setup() {
  const maya = await registerSession(app, "maya@example.com", "Maya Chen");
  const dev = await registerSession(app, "dev@example.com", "Dev Patel");
  const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
  const project = await createProject(maya.cookies);
  await addMembership(project.id, dev.user.id, "member");
  await addMembership(project.id, sam.user.id, "admin");
  return { maya, dev, sam, project };
}

async function insertTask(input: {
  projectId: string;
  columnId: string;
  createdBy: string;
  title: string;
  position: number;
  assigneeId?: string;
  dueDate?: string | null;
}) {
  const [task] = await db
    .insert(tasks)
    .values({
      projectId: input.projectId,
      columnId: input.columnId,
      title: input.title,
      description: `${input.title} description`,
      createdBy: input.createdBy,
      position: input.position,
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ?? null,
    })
    .returning();
  return task;
}

async function listTasks(cookies: string, projectId: string) {
  const response = await request(app)
    .get(`/api/v1/projects/${projectId}/tasks`)
    .set("Cookie", cookies);
  expect(response.status).toBe(200);
  return response.body.data.tasks as Array<{
    id: string;
    title: string;
    columnId: string;
    position: number;
  }>;
}

function moveTask(
  cookies: string,
  taskId: string,
  body: Record<string, unknown>,
) {
  return request(app)
    .patch(`/api/v1/tasks/${taskId}/move`)
    .set("Cookie", cookies)
    .send(body);
}

describe("PATCH /tasks/:taskId", () => {
  it("lets any member edit every field of another member's task", async () => {
    const { maya, dev, sam, project } = await setup();
    const task = await insertTask({
      projectId: project.id,
      columnId: project.columns[0].id,
      createdBy: maya.user.id,
      title: "Original",
      position: 1024,
    });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set("Cookie", dev.cookies)
      .send({
        title: "  Edited by Dev  ",
        description: "New description",
        priority: "urgent",
        dueDate: "2026-12-01",
        assigneeId: sam.user.id,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.task).toMatchObject({
      title: "Edited by Dev",
      description: "New description",
      priority: "urgent",
      dueDate: "2026-12-01",
      assignee: { id: sam.user.id, initials: "SR" },
    });
  });

  it("clears nullable fields and keeps omitted fields unchanged", async () => {
    const { maya, dev, project } = await setup();
    const task = await insertTask({
      projectId: project.id,
      columnId: project.columns[0].id,
      createdBy: maya.user.id,
      title: "Keep title",
      position: 1024,
      assigneeId: dev.user.id,
      dueDate: "2026-11-20",
    });

    const cleared = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set("Cookie", maya.cookies)
      .send({ dueDate: null, assigneeId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.task.dueDate).toBeNull();
    expect(cleared.body.data.task.assignee).toBeNull();
    expect(cleared.body.data.task.title).toBe("Keep title");
    expect(cleared.body.data.task.priority).toBe("medium");

    const titled = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set("Cookie", maya.cookies)
      .send({ title: "Renamed" });
    expect(titled.body.data.task.description).toBe("Keep title description");
  });

  it("rejects a non-member assignee and empty updates", async () => {
    const { maya, project } = await setup();
    const outsider = await registerSession(
      app,
      "outside@example.com",
      "Outside User",
    );
    const task = await insertTask({
      projectId: project.id,
      columnId: project.columns[0].id,
      createdBy: maya.user.id,
      title: "Task",
      position: 1024,
    });

    const assignee = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set("Cookie", maya.cookies)
      .send({ assigneeId: outsider.user.id });
    expect(assignee.status).toBe(422);
    expect(assignee.body.error.code).toBe("INVALID_ASSIGNEE");

    const empty = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set("Cookie", maya.cookies)
      .send({});
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /tasks/:taskId/move", () => {
  it("moves a task to the top, middle, and bottom of its column", async () => {
    const { maya, project } = await setup();
    const [backlog] = project.columns;
    const a = await insertTask({
      projectId: project.id,
      columnId: backlog.id,
      createdBy: maya.user.id,
      title: "A",
      position: 1024,
    });
    const b = await insertTask({
      projectId: project.id,
      columnId: backlog.id,
      createdBy: maya.user.id,
      title: "B",
      position: 2048,
    });
    const c = await insertTask({
      projectId: project.id,
      columnId: backlog.id,
      createdBy: maya.user.id,
      title: "C",
      position: 3072,
    });

    const toTop = await moveTask(maya.cookies, c.id, {
      columnId: backlog.id,
      afterTaskId: a.id,
    });
    expect(toTop.status).toBe(200);
    expect(toTop.body.data.task.position).toBe(0);
    expect(
      (await listTasks(maya.cookies, project.id)).map((t) => t.title),
    ).toEqual(["C", "A", "B"]);

    const toMiddle = await moveTask(maya.cookies, c.id, {
      columnId: backlog.id,
      beforeTaskId: a.id,
      afterTaskId: b.id,
    });
    expect(toMiddle.body.data.task.position).toBe(1536);
    expect(
      (await listTasks(maya.cookies, project.id)).map((t) => t.title),
    ).toEqual(["A", "C", "B"]);

    const toBottom = await moveTask(maya.cookies, c.id, {
      columnId: backlog.id,
      beforeTaskId: b.id,
    });
    expect(toBottom.body.data.task.position).toBe(3072);
    const final = await listTasks(maya.cookies, project.id);
    expect(final.map((task) => task.title)).toEqual(["A", "B", "C"]);
    expect(final.map((task) => task.position)).toEqual([1024, 2048, 3072]);
  });

  it("moves across columns and into an empty column", async () => {
    const { maya, project } = await setup();
    const [backlog, doing, done] = project.columns;
    const moving = await insertTask({
      projectId: project.id,
      columnId: backlog.id,
      createdBy: maya.user.id,
      title: "Moving",
      position: 1024,
    });
    const d1 = await insertTask({
      projectId: project.id,
      columnId: doing.id,
      createdBy: maya.user.id,
      title: "D1",
      position: 1024,
    });
    const d2 = await insertTask({
      projectId: project.id,
      columnId: doing.id,
      createdBy: maya.user.id,
      title: "D2",
      position: 2048,
    });

    const between = await moveTask(maya.cookies, moving.id, {
      columnId: doing.id,
      beforeTaskId: d1.id,
      afterTaskId: d2.id,
    });
    expect(between.status).toBe(200);
    expect(between.body.data.task).toMatchObject({
      columnId: doing.id,
      position: 1536,
    });

    const empty = await moveTask(maya.cookies, moving.id, {
      columnId: done.id,
    });
    expect(empty.body.data.task).toMatchObject({
      columnId: done.id,
      position: 1024,
    });

    const list = await listTasks(maya.cookies, project.id);
    expect(
      list
        .filter((task) => task.columnId === done.id)
        .map((task) => task.title),
    ).toEqual(["Moving"]);
  });

  it("rejects a foreign column and invalid neighbours", async () => {
    const { maya, project } = await setup();
    const [backlog, doing] = project.columns;
    const other = await createProject(maya.cookies, "Other");
    const moving = await insertTask({
      projectId: project.id,
      columnId: backlog.id,
      createdBy: maya.user.id,
      title: "Moving",
      position: 1024,
    });
    const inBacklog = await insertTask({
      projectId: project.id,
      columnId: backlog.id,
      createdBy: maya.user.id,
      title: "Backlog neighbour",
      position: 2048,
    });
    await insertTask({
      projectId: project.id,
      columnId: doing.id,
      createdBy: maya.user.id,
      title: "Doing neighbour",
      position: 1024,
    });

    const foreign = await moveTask(maya.cookies, moving.id, {
      columnId: other.columns[0].id,
    });
    expect(foreign.status).toBe(422);
    expect(foreign.body.error.code).toBe("INVALID_COLUMN");

    const wrongColumn = await moveTask(maya.cookies, moving.id, {
      columnId: doing.id,
      beforeTaskId: inBacklog.id,
    });
    expect(wrongColumn.status).toBe(422);
    expect(wrongColumn.body.error.code).toBe("INVALID_NEIGHBOURS");

    const itself = await moveTask(maya.cookies, moving.id, {
      columnId: backlog.id,
      beforeTaskId: moving.id,
    });
    expect(itself.status).toBe(422);
    expect(itself.body.error.code).toBe("INVALID_NEIGHBOURS");

    const inverted = await moveTask(maya.cookies, moving.id, {
      columnId: backlog.id,
      beforeTaskId: inBacklog.id,
      afterTaskId: moving.id,
    });
    expect(inverted.status).toBe(422);
    expect(inverted.body.error.code).toBe("INVALID_NEIGHBOURS");
  });

  it("renumbers a tight column before placing the moved task", async () => {
    const { maya, project } = await setup();
    const [backlog, doing] = project.columns;
    const a = await insertTask({
      projectId: project.id,
      columnId: doing.id,
      createdBy: maya.user.id,
      title: "A",
      position: 1024,
    });
    const b = await insertTask({
      projectId: project.id,
      columnId: doing.id,
      createdBy: maya.user.id,
      title: "B",
      position: 1024 + 1e-7,
    });
    const moving = await insertTask({
      projectId: project.id,
      columnId: backlog.id,
      createdBy: maya.user.id,
      title: "Moving",
      position: 1024,
    });

    const response = await moveTask(maya.cookies, moving.id, {
      columnId: doing.id,
      beforeTaskId: a.id,
      afterTaskId: b.id,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.task.position).toBe(1536);

    const doingTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.columnId, doing.id))
      .orderBy(asc(tasks.position));
    expect(doingTasks.map((task) => [task.title, task.position])).toEqual([
      ["A", 1024],
      ["Moving", 1536],
      ["B", 2048],
    ]);
  });

  it("returns 404 for non-members and 422 for malformed payloads", async () => {
    const { maya, project } = await setup();
    const outsider = await registerSession(
      app,
      "outside@example.com",
      "Outside User",
    );
    const task = await insertTask({
      projectId: project.id,
      columnId: project.columns[0].id,
      createdBy: maya.user.id,
      title: "Task",
      position: 1024,
    });

    const nonMember = await moveTask(outsider.cookies, task.id, {
      columnId: project.columns[1].id,
    });
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe("TASK_NOT_FOUND");

    const malformed = await moveTask(maya.cookies, task.id, {
      columnId: "not-a-uuid",
    });
    expect(malformed.status).toBe(422);

    const anonymous = await request(app)
      .patch(`/api/v1/tasks/${task.id}/move`)
      .send({ columnId: project.columns[1].id });
    expect(anonymous.status).toBe(401);
  });
});

describe("DELETE /tasks/:taskId", () => {
  it("enforces creator, admin, and owner deletion rules", async () => {
    const { maya, dev, sam, project } = await setup();
    const columnId = project.columns[0].id;

    const byCreator = await insertTask({
      projectId: project.id,
      columnId,
      createdBy: dev.user.id,
      title: "Dev's task",
      position: 1024,
    });
    const byMaya = await insertTask({
      projectId: project.id,
      columnId,
      createdBy: maya.user.id,
      title: "Maya's task",
      position: 2048,
    });
    const forAdmin = await insertTask({
      projectId: project.id,
      columnId,
      createdBy: maya.user.id,
      title: "Admin target",
      position: 3072,
    });
    const forOwner = await insertTask({
      projectId: project.id,
      columnId,
      createdBy: dev.user.id,
      title: "Owner target",
      position: 4096,
    });

    const creatorDeletes = await request(app)
      .delete(`/api/v1/tasks/${byCreator.id}`)
      .set("Cookie", dev.cookies);
    expect(creatorDeletes.status).toBe(204);

    const memberDeletesOther = await request(app)
      .delete(`/api/v1/tasks/${byMaya.id}`)
      .set("Cookie", dev.cookies);
    expect(memberDeletesOther.status).toBe(403);
    expect(memberDeletesOther.body.error.code).toBe("FORBIDDEN");

    const adminDeletes = await request(app)
      .delete(`/api/v1/tasks/${forAdmin.id}`)
      .set("Cookie", sam.cookies);
    expect(adminDeletes.status).toBe(204);

    const ownerDeletes = await request(app)
      .delete(`/api/v1/tasks/${forOwner.id}`)
      .set("Cookie", maya.cookies);
    expect(ownerDeletes.status).toBe(204);

    const stored = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, project.id));
    expect(stored.map((task) => task.title)).toEqual(["Maya's task"]);
  });

  it("cascades comments and hides the task from non-members", async () => {
    const { maya, dev, project } = await setup();
    const outsider = await registerSession(
      app,
      "outside@example.com",
      "Outside User",
    );
    const task = await insertTask({
      projectId: project.id,
      columnId: project.columns[0].id,
      createdBy: maya.user.id,
      title: "With comments",
      position: 1024,
    });
    await db.insert(comments).values([
      { taskId: task.id, authorId: dev.user.id, body: "One" },
      { taskId: task.id, authorId: maya.user.id, body: "Two" },
    ]);

    const nonMember = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set("Cookie", outsider.cookies);
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe("TASK_NOT_FOUND");

    const deleted = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set("Cookie", maya.cookies);
    expect(deleted.status).toBe(204);

    const remaining = await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, task.id));
    expect(remaining).toHaveLength(0);

    const anonymous = await request(app).delete(`/api/v1/tasks/${task.id}`);
    expect(anonymous.status).toBe(401);
  });
});
