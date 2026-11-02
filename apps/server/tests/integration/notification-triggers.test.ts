import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import {
  comments,
  notifications,
  projectMembers,
  tasks,
} from "../../src/db/schema/index.js";
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
  role: "admin" | "member",
) {
  await db.insert(projectMembers).values({ projectId, userId, role });
}

async function setup() {
  const maya = await registerSession(app, "maya@example.com", "Maya Chen");
  const dev = await registerSession(app, "dev@example.com", "Dev Patel");
  const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
  const project = await createProject(maya.cookies);
  await addMembership(project.id, dev.user.id, "member");
  await addMembership(project.id, sam.user.id, "member");
  return { maya, dev, sam, project };
}

function createTask(
  cookies: string,
  projectId: string,
  columnId: string,
  body: Record<string, unknown> = {},
) {
  return request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set("Cookie", cookies)
    .send({ columnId, title: "Notification task", ...body });
}

async function notificationRows() {
  return db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      actorId: notifications.actorId,
      type: notifications.type,
      projectId: notifications.projectId,
      taskId: notifications.taskId,
      commentId: notifications.commentId,
    })
    .from(notifications);
}

async function taskCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks);
  return row.count;
}

async function commentCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments);
  return row.count;
}

describe("task assignment notifications", () => {
  it("creates exactly one notification when a task is created with an assignee", async () => {
    const { maya, dev, project } = await setup();

    const response = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { assigneeId: dev.user.id },
    );

    expect(response.status).toBe(201);
    const rows = await notificationRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: dev.user.id,
      actorId: maya.user.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: response.body.data.task.id,
      commentId: null,
    });
  });

  it("creates none for an unassigned task or a self-assignment", async () => {
    const { maya, project } = await setup();

    const unassigned = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
    );
    expect(unassigned.status).toBe(201);

    const selfAssigned = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { title: "Mine", assigneeId: maya.user.id },
    );
    expect(selfAssigned.status).toBe(201);

    expect(await notificationRows()).toHaveLength(0);
  });

  it("notifies only when the assignee changes to a different user", async () => {
    const { maya, dev, sam, project } = await setup();
    const created = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { assigneeId: dev.user.id },
    );
    const taskId = created.body.data.task.id as string;
    expect(await notificationRows()).toHaveLength(1);

    const toSam = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set("Cookie", maya.cookies)
      .send({ assigneeId: sam.user.id });
    expect(toSam.status).toBe(200);

    const afterSam = await notificationRows();
    expect(afterSam).toHaveLength(2);
    expect(afterSam[1]).toMatchObject({
      userId: sam.user.id,
      actorId: maya.user.id,
      type: "task_assigned",
      taskId,
    });

    const sameAgain = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set("Cookie", maya.cookies)
      .send({ assigneeId: sam.user.id });
    expect(sameAgain.status).toBe(200);

    const toNull = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set("Cookie", maya.cookies)
      .send({ assigneeId: null });
    expect(toNull.status).toBe(200);

    expect(await notificationRows()).toHaveLength(2);
  });

  it("creates no assignment notification when the actor assigns themselves", async () => {
    const { maya, dev, project } = await setup();
    const created = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
    );
    const taskId = created.body.data.task.id as string;

    const response = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set("Cookie", dev.cookies)
      .send({ assigneeId: dev.user.id });

    expect(response.status).toBe(200);
    expect(response.body.data.task.assignee.id).toBe(dev.user.id);
    expect(await notificationRows()).toHaveLength(0);
  });
});

describe("comment notifications", () => {
  it("notifies the assignee and creator exactly once each, never the commenter", async () => {
    const { maya, dev, sam, project } = await setup();
    const created = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { assigneeId: dev.user.id },
    );
    const taskId = created.body.data.task.id as string;
    await db.delete(notifications);

    const response = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set("Cookie", sam.cookies)
      .send({ body: "A comment from Sam" });

    expect(response.status).toBe(201);
    const rows = await notificationRows();
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.userId).sort()).toEqual(
      [dev.user.id, maya.user.id].sort(),
    );
    for (const row of rows) {
      expect(row).toMatchObject({
        actorId: sam.user.id,
        type: "comment_added",
        projectId: project.id,
        taskId,
        commentId: response.body.data.comment.id,
      });
    }
  });

  it("dedupes when creator and assignee are the same person", async () => {
    const { maya, dev, project } = await setup();
    const created = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { assigneeId: maya.user.id },
    );
    const taskId = created.body.data.task.id as string;
    expect(await notificationRows()).toHaveLength(0);

    const response = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set("Cookie", dev.cookies)
      .send({ body: "Nice" });

    expect(response.status).toBe(201);
    const rows = await notificationRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: maya.user.id,
      actorId: dev.user.id,
      type: "comment_added",
    });
  });

  it("creates nothing for a self-comment on your own assigned task", async () => {
    const { maya, project } = await setup();
    const created = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { assigneeId: maya.user.id },
    );
    const taskId = created.body.data.task.id as string;

    const response = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set("Cookie", maya.cookies)
      .send({ body: "Talking to myself" });

    expect(response.status).toBe(201);
    expect(await notificationRows()).toHaveLength(0);
  });

  it("skips a stale assignee who is no longer a project member", async () => {
    const { maya, dev, project } = await setup();
    const created = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { assigneeId: dev.user.id },
    );
    const taskId = created.body.data.task.id as string;
    await db.delete(notifications);

    // Simulate a stale reference: drop the membership without unassigning.
    await db.execute(
      sql`delete from project_members where project_id = ${project.id} and user_id = ${dev.user.id}`,
    );

    const response = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set("Cookie", maya.cookies)
      .send({ body: "Anyone there?" });

    expect(response.status).toBe(201);
    expect(await notificationRows()).toHaveLength(0);
  });
});

describe("notification cascades and removal", () => {
  it("deletes notifications when the task, comment, or project is deleted", async () => {
    const { maya, dev, project } = await setup();

    const taskResponse = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { assigneeId: dev.user.id },
    );
    const taskId = taskResponse.body.data.task.id as string;
    expect(await notificationRows()).toHaveLength(1);

    await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set("Cookie", maya.cookies)
      .expect(204);
    expect(await notificationRows()).toHaveLength(0);

    const second = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { title: "Comment cascade", assigneeId: dev.user.id },
    );
    const secondTaskId = second.body.data.task.id as string;
    await db.delete(notifications);
    const comment = await request(app)
      .post(`/api/v1/tasks/${secondTaskId}/comments`)
      .set("Cookie", maya.cookies)
      .send({ body: "Dev will be notified" });
    expect(comment.status).toBe(201);
    expect(await notificationRows()).toHaveLength(1);

    await request(app)
      .delete(`/api/v1/comments/${comment.body.data.comment.id}`)
      .set("Cookie", maya.cookies)
      .expect(204);
    expect(await notificationRows()).toHaveLength(0);

    const third = await createTask(
      maya.cookies,
      project.id,
      project.columns[0].id,
      { title: "Project cascade", assigneeId: dev.user.id },
    );
    expect(third.status).toBe(201);
    expect(await notificationRows()).toHaveLength(1);

    await request(app)
      .delete(`/api/v1/projects/${project.id}`)
      .set("Cookie", maya.cookies)
      .expect(204);
    expect(await notificationRows()).toHaveLength(0);
  });

  it("deletes a removed member's project notifications", async () => {
    const { maya, dev, project } = await setup();
    await createTask(maya.cookies, project.id, project.columns[0].id, {
      assigneeId: dev.user.id,
    });
    expect(await notificationRows()).toHaveLength(1);

    const response = await request(app)
      .delete(`/api/v1/projects/${project.id}/members/${dev.user.id}`)
      .set("Cookie", maya.cookies);

    expect(response.status).toBe(204);
    expect(await notificationRows()).toHaveLength(0);
  });
});

describe("transactional notifications", () => {
  it("rolls back the task and comment write when the notification insert fails", async () => {
    const { maya, dev, project } = await setup();
    const triggerName = `fail_notifications_${Date.now()}`;
    const functionName = `fail_notification_insert_${Date.now()}`;

    await db.execute(
      sql.raw(`
        CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'forced notification failure';
        END;
        $$ LANGUAGE plpgsql;
      `),
    );
    await db.execute(
      sql.raw(`
        CREATE TRIGGER ${triggerName}
        BEFORE INSERT ON notifications
        FOR EACH ROW EXECUTE FUNCTION ${functionName}();
      `),
    );

    try {
      const failedTask = await createTask(
        maya.cookies,
        project.id,
        project.columns[0].id,
        { assigneeId: dev.user.id },
      );
      expect(failedTask.status).toBe(500);
      expect(await taskCount()).toBe(0);
      expect(await notificationRows()).toHaveLength(0);

      await db.execute(sql.raw(`DROP TRIGGER ${triggerName} ON notifications`));
      const created = await createTask(
        maya.cookies,
        project.id,
        project.columns[0].id,
        { title: "Notification target" },
      );
      expect(created.status).toBe(201);
      await db.execute(
        sql.raw(`
          CREATE TRIGGER ${triggerName}
          BEFORE INSERT ON notifications
          FOR EACH ROW EXECUTE FUNCTION ${functionName}();
        `),
      );

      const failedComment = await request(app)
        .post(`/api/v1/tasks/${created.body.data.task.id}/comments`)
        .set("Cookie", dev.cookies)
        .send({ body: "Should roll back" });
      expect(failedComment.status).toBe(500);
      expect(await commentCount()).toBe(0);
    } finally {
      await db.execute(
        sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON notifications`),
      );
      await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${functionName}()`));
      await db.execute(sql`delete from notifications`);
    }
  });
});
