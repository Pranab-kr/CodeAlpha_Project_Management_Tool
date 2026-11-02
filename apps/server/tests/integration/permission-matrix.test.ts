import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import {
  boardColumns,
  comments,
  projectMembers,
  projects,
  tasks,
} from "../../src/db/schema/index.js";
import { closeTestPool, resetDb } from "../helpers/db.js";
import { createTestUser, type FixtureUser } from "../helpers/fixtures.js";

const app = createApp();

beforeEach(resetDb);
afterAll(closeTestPool);

interface Setup {
  maya: FixtureUser;
  sam: FixtureUser;
  dev: FixtureUser;
  ava: FixtureUser;
  project: { id: string };
  columns: { id: string; name: string; position: number }[];
}

async function setup(): Promise<Setup> {
  const maya = await createTestUser("Maya Chen", "maya@example.com");
  const sam = await createTestUser("Sam Rivera", "sam@example.com");
  const dev = await createTestUser("Dev Patel", "dev@example.com");
  const ava = await createTestUser("Ava Stone", "ava@example.com");

  const [project] = await db
    .insert(projects)
    .values({ name: "Alpha", ownerId: maya.id })
    .returning();
  await db.insert(projectMembers).values([
    { projectId: project.id, userId: maya.id, role: "owner" },
    { projectId: project.id, userId: sam.id, role: "admin" },
    { projectId: project.id, userId: dev.id, role: "member" },
    { projectId: project.id, userId: ava.id, role: "member" },
  ]);
  const columns = await db
    .insert(boardColumns)
    .values([
      { projectId: project.id, name: "Backlog", position: 1024 },
      { projectId: project.id, name: "Done", position: 2048 },
    ])
    .returning();
  return { maya, sam, dev, ava, project, columns };
}

async function createTask(
  setup: Setup,
  createdBy: FixtureUser,
  title = "Task",
) {
  const [task] = await db
    .insert(tasks)
    .values({
      projectId: setup.project.id,
      columnId: setup.columns[0].id,
      title,
      createdBy: createdBy.id,
      position: 1024,
    })
    .returning();
  return task;
}

async function createComment(
  taskId: string,
  author: FixtureUser,
  body = "Comment",
) {
  const [comment] = await db
    .insert(comments)
    .values({ taskId, authorId: author.id, body })
    .returning();
  return comment;
}

describe("read access", () => {
  it("lets every project role view the project, board, members, tasks, and comments", async () => {
    const context = await setup();
    const task = await createTask(context, context.maya);
    await createComment(task.id, context.maya);

    for (const user of [context.maya, context.sam, context.dev, context.ava]) {
      const requests = [
        ["get", `/api/v1/projects/${context.project.id}`],
        ["get", `/api/v1/projects/${context.project.id}/tasks`],
        ["get", `/api/v1/projects/${context.project.id}/members`],
        ["get", `/api/v1/tasks/${task.id}`],
        ["get", `/api/v1/tasks/${task.id}/comments`],
      ] as const;
      for (const [method, path] of requests) {
        const agent = request(app);
        const response = await agent[method](path).set("Cookie", user.cookies);
        expect([user.name, path, response.status]).toEqual([
          user.name,
          path,
          200,
        ]);
      }
    }
  });
});

describe("task permissions", () => {
  it("lets a member create, edit, move, reassign, and delete their own task", async () => {
    const context = await setup();

    const created = await request(app)
      .post(`/api/v1/projects/${context.project.id}/tasks`)
      .set("Cookie", context.dev.cookies)
      .send({ columnId: context.columns[0].id, title: "Member task" });
    expect(created.status).toBe(201);
    const taskId = created.body.data.task.id as string;

    const edited = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set("Cookie", context.dev.cookies)
      .send({ title: "Edited", priority: "urgent" });
    expect(edited.status).toBe(200);

    const moved = await request(app)
      .patch(`/api/v1/tasks/${taskId}/move`)
      .set("Cookie", context.dev.cookies)
      .send({ columnId: context.columns[1].id });
    expect(moved.status).toBe(200);

    const reassigned = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set("Cookie", context.dev.cookies)
      .send({ assigneeId: context.sam.id, title: "Reassigned" });
    expect(reassigned.status).toBe(200);

    const deleted = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set("Cookie", context.dev.cookies);
    expect(deleted.status).toBe(204);
  });

  it("limits deleting another member's task to admins and owners", async () => {
    const context = await setup();
    const mayasTask = await createTask(context, context.maya, "Maya task");
    const devsTask = await createTask(context, context.dev, "Dev task");

    const member = await request(app)
      .delete(`/api/v1/tasks/${mayasTask.id}`)
      .set("Cookie", context.dev.cookies);
    expect(member.status).toBe(403);
    expect(member.body.error.code).toBe("FORBIDDEN");

    const admin = await request(app)
      .delete(`/api/v1/tasks/${mayasTask.id}`)
      .set("Cookie", context.sam.cookies);
    expect(admin.status).toBe(204);

    const owner = await request(app)
      .delete(`/api/v1/tasks/${devsTask.id}`)
      .set("Cookie", context.maya.cookies);
    expect(owner.status).toBe(204);
  });
});

describe("comment permissions", () => {
  it("lets authors edit and delete their own comments", async () => {
    const context = await setup();
    const task = await createTask(context, context.maya);

    const created = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set("Cookie", context.dev.cookies)
      .send({ body: "Mine" });
    expect(created.status).toBe(201);
    const commentId = created.body.data.comment.id as string;

    expect(
      (
        await request(app)
          .patch(`/api/v1/comments/${commentId}`)
          .set("Cookie", context.dev.cookies)
          .send({ body: "Mine, edited" })
      ).status,
    ).toBe(200);

    expect(
      (
        await request(app)
          .delete(`/api/v1/comments/${commentId}`)
          .set("Cookie", context.dev.cookies)
      ).status,
    ).toBe(204);
  });

  it("forbids editing others' comments at every role and lets managers delete them", async () => {
    const context = await setup();
    const task = await createTask(context, context.maya);
    const mayasComment = await createComment(
      task.id,
      context.maya,
      "Maya's comment",
    );

    for (const user of [context.dev, context.sam, context.ava]) {
      const response = await request(app)
        .patch(`/api/v1/comments/${mayasComment.id}`)
        .set("Cookie", user.cookies)
        .send({ body: "Hijacked" });
      expect(response.status).toBe(403);
    }

    const memberDelete = await request(app)
      .delete(`/api/v1/comments/${mayasComment.id}`)
      .set("Cookie", context.dev.cookies);
    expect(memberDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/api/v1/comments/${mayasComment.id}`)
      .set("Cookie", context.sam.cookies);
    expect(adminDelete.status).toBe(204);
  });

  it("lets the owner delete another member's comment but not edit it", async () => {
    const context = await setup();
    const task = await createTask(context, context.maya);
    const devsComment = await createComment(task.id, context.dev);

    const edit = await request(app)
      .patch(`/api/v1/comments/${devsComment.id}`)
      .set("Cookie", context.maya.cookies)
      .send({ body: "Owner edit" });
    expect(edit.status).toBe(403);

    const remove = await request(app)
      .delete(`/api/v1/comments/${devsComment.id}`)
      .set("Cookie", context.maya.cookies);
    expect(remove.status).toBe(204);
  });
});

describe("board, project, and member permissions", () => {
  it("reserves column management for admins and owners", async () => {
    const context = await setup();

    const member = await request(app)
      .post(`/api/v1/projects/${context.project.id}/columns`)
      .set("Cookie", context.dev.cookies)
      .send({ name: "Blocked" });
    expect(member.status).toBe(403);
    expect(member.body.error.code).toBe("FORBIDDEN");

    const created = await request(app)
      .post(`/api/v1/projects/${context.project.id}/columns`)
      .set("Cookie", context.sam.cookies)
      .send({ name: "QA" });
    expect(created.status).toBe(201);
    const columnId = created.body.data.column.id as string;

    expect(
      (
        await request(app)
          .patch(`/api/v1/columns/${columnId}`)
          .set("Cookie", context.sam.cookies)
          .send({ name: "Review" })
      ).status,
    ).toBe(200);

    const detail = await request(app)
      .get(`/api/v1/projects/${context.project.id}`)
      .set("Cookie", context.maya.cookies);
    const order = (detail.body.data.project.columns as { id: string }[]).map(
      (column) => column.id,
    );
    expect(
      (
        await request(app)
          .patch(`/api/v1/projects/${context.project.id}/columns/reorder`)
          .set("Cookie", context.sam.cookies)
          .send({ columnIds: order })
      ).status,
    ).toBe(200);

    expect(
      (
        await request(app)
          .delete(`/api/v1/columns/${columnId}`)
          .set("Cookie", context.maya.cookies)
      ).status,
    ).toBe(204);
  });

  it("reserves project edits for admins and owners", async () => {
    const context = await setup();

    for (const user of [context.dev, context.ava]) {
      const response = await request(app)
        .patch(`/api/v1/projects/${context.project.id}`)
        .set("Cookie", user.cookies)
        .send({ name: "Member edit" });
      expect(response.status).toBe(403);
    }
    for (const user of [context.sam, context.maya]) {
      const response = await request(app)
        .patch(`/api/v1/projects/${context.project.id}`)
        .set("Cookie", user.cookies)
        .send({ name: "Manager edit" });
      expect(response.status).toBe(200);
    }
  });

  it("reserves adding members for admins and owners", async () => {
    const context = await setup();
    const outsider = await createTestUser("Tom Hale", "tom@example.com");
    const ownerTarget = await createTestUser("Zoe Lane", "zoe@example.com");

    const member = await request(app)
      .post(`/api/v1/projects/${context.project.id}/members`)
      .set("Cookie", context.dev.cookies)
      .send({ email: outsider.email });
    expect(member.status).toBe(403);

    const admin = await request(app)
      .post(`/api/v1/projects/${context.project.id}/members`)
      .set("Cookie", context.sam.cookies)
      .send({ email: outsider.email });
    expect(admin.status).toBe(201);

    const owner = await request(app)
      .post(`/api/v1/projects/${context.project.id}/members`)
      .set("Cookie", context.maya.cookies)
      .send({ email: ownerTarget.email });
    expect(owner.status).toBe(201);
  });

  it("applies the member-removal hierarchy", async () => {
    const context = await setup();

    const memberRemovesMember = await request(app)
      .delete(
        `/api/v1/projects/${context.project.id}/members/${context.ava.id}`,
      )
      .set("Cookie", context.dev.cookies);
    expect(memberRemovesMember.status).toBe(403);

    const adminRemovesMember = await request(app)
      .delete(
        `/api/v1/projects/${context.project.id}/members/${context.ava.id}`,
      )
      .set("Cookie", context.sam.cookies);
    expect(adminRemovesMember.status).toBe(204);

    expect(
      (
        await request(app)
          .patch(
            `/api/v1/projects/${context.project.id}/members/${context.ava.id}`,
          )
          .set("Cookie", context.maya.cookies)
          .send({ role: "admin" })
      ).status,
    ).toBe(404);
  });

  it("stops admins removing admins and anyone removing the owner", async () => {
    const context = await setup();
    await request(app)
      .patch(`/api/v1/projects/${context.project.id}/members/${context.ava.id}`)
      .set("Cookie", context.maya.cookies)
      .send({ role: "admin" })
      .expect(200);

    const adminOnAdmin = await request(app)
      .delete(
        `/api/v1/projects/${context.project.id}/members/${context.ava.id}`,
      )
      .set("Cookie", context.sam.cookies);
    expect(adminOnAdmin.status).toBe(403);
    expect(adminOnAdmin.body.error.code).toBe("FORBIDDEN");

    const ownerRemovesAdmin = await request(app)
      .delete(
        `/api/v1/projects/${context.project.id}/members/${context.sam.id}`,
      )
      .set("Cookie", context.maya.cookies);
    expect(ownerRemovesAdmin.status).toBe(204);

    const ownerOnOwner = await request(app)
      .delete(
        `/api/v1/projects/${context.project.id}/members/${context.maya.id}`,
      )
      .set("Cookie", context.maya.cookies);
    expect(ownerOnOwner.status).toBe(409);
    expect(ownerOnOwner.body.error.code).toBe("CANNOT_REMOVE_OWNER");
  });

  it("lets a member leave but not remove others", async () => {
    const context = await setup();

    const removeOther = await request(app)
      .delete(
        `/api/v1/projects/${context.project.id}/members/${context.ava.id}`,
      )
      .set("Cookie", context.dev.cookies);
    expect(removeOther.status).toBe(403);

    const leave = await request(app)
      .delete(
        `/api/v1/projects/${context.project.id}/members/${context.dev.id}`,
      )
      .set("Cookie", context.dev.cookies);
    expect(leave.status).toBe(204);

    const after = await request(app)
      .get(`/api/v1/projects/${context.project.id}`)
      .set("Cookie", context.dev.cookies);
    expect(after.status).toBe(404);
  });

  it("reserves role changes for the owner", async () => {
    const context = await setup();

    for (const user of [context.dev, context.sam]) {
      const response = await request(app)
        .patch(
          `/api/v1/projects/${context.project.id}/members/${context.ava.id}`,
        )
        .set("Cookie", user.cookies)
        .send({ role: "admin" });
      expect(response.status).toBe(403);
    }

    const owner = await request(app)
      .patch(`/api/v1/projects/${context.project.id}/members/${context.ava.id}`)
      .set("Cookie", context.maya.cookies)
      .send({ role: "admin" });
    expect(owner.status).toBe(200);
    expect(owner.body.data.member.role).toBe("admin");
  });

  it("reserves project deletion for the owner", async () => {
    const context = await setup();

    for (const user of [context.dev, context.sam]) {
      const response = await request(app)
        .delete(`/api/v1/projects/${context.project.id}`)
        .set("Cookie", user.cookies);
      expect(response.status).toBe(403);
    }

    const owner = await request(app)
      .delete(`/api/v1/projects/${context.project.id}`)
      .set("Cookie", context.maya.cookies);
    expect(owner.status).toBe(204);
  });
});
