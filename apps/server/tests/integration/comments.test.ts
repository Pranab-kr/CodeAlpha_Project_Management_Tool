import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import { comments, projectMembers, tasks } from "../../src/db/schema/index.js";
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
    columns: { id: string; name: string; position: number }[];
  };
}

async function addMembership(
  projectId: string,
  userId: string,
  role: "admin" | "member",
) {
  await db.insert(projectMembers).values({ projectId, userId, role });
}

async function insertTask(input: {
  projectId: string;
  columnId: string;
  createdBy: string;
  title?: string;
  assigneeId?: string | null;
}) {
  const [task] = await db
    .insert(tasks)
    .values({
      projectId: input.projectId,
      columnId: input.columnId,
      title: input.title ?? "Comment target",
      createdBy: input.createdBy,
      assigneeId: input.assigneeId ?? null,
      position: 1024,
    })
    .returning();
  return task;
}

async function setup(options: { samRole?: "admin" | "member" } = {}) {
  const maya = await registerSession(app, "maya@example.com", "Maya Chen");
  const dev = await registerSession(app, "dev@example.com", "Dev Patel");
  const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
  const project = await createProject(maya.cookies);
  await addMembership(project.id, dev.user.id, "member");
  if (options.samRole) {
    await addMembership(project.id, sam.user.id, options.samRole);
  }
  const task = await insertTask({
    projectId: project.id,
    columnId: project.columns[0].id,
    createdBy: maya.user.id,
    assigneeId: dev.user.id,
  });
  return { maya, dev, sam, project, task };
}

function postComment(cookies: string, taskId: string, body: object) {
  return request(app)
    .post(`/api/v1/tasks/${taskId}/comments`)
    .set("Cookie", cookies)
    .send(body);
}

function listComments(cookies: string, taskId: string) {
  return request(app)
    .get(`/api/v1/tasks/${taskId}/comments`)
    .set("Cookie", cookies);
}

function patchComment(cookies: string, commentId: string, body: object) {
  return request(app)
    .patch(`/api/v1/comments/${commentId}`)
    .set("Cookie", cookies)
    .send(body);
}

function deleteComment(cookies: string, commentId: string) {
  return request(app)
    .delete(`/api/v1/comments/${commentId}`)
    .set("Cookie", cookies);
}

describe("GET /tasks/:taskId/comments", () => {
  it("returns an empty list for a task without comments", async () => {
    const { dev, task } = await setup();

    const response = await listComments(dev.cookies, task.id);

    expect(response.status).toBe(200);
    expect(response.body.data.comments).toEqual([]);
  });

  it("returns comments oldest-first with the id as the tiebreaker", async () => {
    const { maya, dev, task } = await setup();
    const sameTime = new Date("2026-11-02T10:00:00.000Z");
    const inserted = await db
      .insert(comments)
      .values([
        {
          taskId: task.id,
          authorId: maya.user.id,
          body: "Same time A",
          createdAt: sameTime,
        },
        {
          taskId: task.id,
          authorId: dev.user.id,
          body: "Older",
          createdAt: new Date("2026-11-02T09:00:00.000Z"),
        },
        {
          taskId: task.id,
          authorId: maya.user.id,
          body: "Same time B",
          createdAt: sameTime,
        },
      ])
      .returning();

    const response = await listComments(dev.cookies, task.id);

    expect(response.status).toBe(200);
    const list = response.body.data.comments as { id: string; body: string }[];
    expect(list[0].body).toBe("Older");
    const tiedIds = inserted
      .filter((comment) => comment.body.startsWith("Same time"))
      .map((comment) => comment.id)
      .sort();
    expect(list.slice(1).map((comment) => comment.id)).toEqual(tiedIds);
    expect(list).toHaveLength(3);
  });

  it("caps the read at the oldest 200 comments", async () => {
    const { maya, dev, task } = await setup();
    const base = new Date("2026-11-01T00:00:00.000Z").getTime();

    await db.insert(comments).values(
      Array.from({ length: 205 }, (_, index) => ({
        taskId: task.id,
        authorId: maya.user.id,
        body: `Comment ${index}`,
        createdAt: new Date(base + index * 1000),
      })),
    );

    const response = await listComments(dev.cookies, task.id);

    expect(response.status).toBe(200);
    const list = response.body.data.comments as { body: string }[];
    expect(list).toHaveLength(200);
    expect(list[0].body).toBe("Comment 0");
    expect(list[199].body).toBe("Comment 199");
  });
});

describe("POST /tasks/:taskId/comments", () => {
  it("creates a trimmed comment with the author summary", async () => {
    const { maya, dev, task } = await setup();

    const response = await postComment(dev.cookies, task.id, {
      body: "  Looks good to me  ",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.comment).toMatchObject({
      taskId: task.id,
      body: "Looks good to me",
      author: {
        id: dev.user.id,
        name: "Dev Patel",
        initials: "DP",
      },
    });
    expect(response.body.data.comment.createdAt).toBeTruthy();
    expect(response.body.data.comment.updatedAt).toBeTruthy();

    const list = await listComments(maya.cookies, task.id);
    expect(list.body.data.comments).toHaveLength(1);
  });

  it("rejects empty, whitespace-only, and 5,001-character bodies", async () => {
    const { dev, task } = await setup();

    for (const body of [
      { body: "" },
      { body: "   \n\t " },
      { body: "x".repeat(5001) },
    ]) {
      const response = await postComment(dev.cookies, task.id, body);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns 404 to non-members and for missing tasks", async () => {
    const { sam, task } = await setup();

    const nonMemberList = await listComments(sam.cookies, task.id);
    expect(nonMemberList.status).toBe(404);
    expect(nonMemberList.body.error.code).toBe("TASK_NOT_FOUND");

    const nonMemberCreate = await postComment(sam.cookies, task.id, {
      body: "Sneaky",
    });
    expect(nonMemberCreate.status).toBe(404);
    expect(nonMemberCreate.body.error.code).toBe("TASK_NOT_FOUND");

    const missing = await postComment(sam.cookies, MISSING_ID, {
      body: "Nowhere",
    });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("returns 401 for signed-out requests", async () => {
    const { task } = await setup();

    const list = await request(app).get(`/api/v1/tasks/${task.id}/comments`);
    expect(list.status).toBe(401);

    const create = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .send({ body: "Anonymous" });
    expect(create.status).toBe(401);

    const update = await request(app)
      .patch(`/api/v1/comments/${MISSING_ID}`)
      .send({ body: "Anonymous" });
    expect(update.status).toBe(401);

    const remove = await request(app).delete(`/api/v1/comments/${MISSING_ID}`);
    expect(remove.status).toBe(401);
  });
});

describe("PATCH /comments/:commentId", () => {
  it("lets the author edit the body and bumps updatedAt", async () => {
    const { dev, task } = await setup();
    const created = await postComment(dev.cookies, task.id, { body: "First" });
    const original = created.body.data.comment as {
      id: string;
      updatedAt: string;
    };

    await new Promise((resolve) => setTimeout(resolve, 5));

    const response = await patchComment(dev.cookies, original.id, {
      body: "  First, edited  ",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.comment.body).toBe("First, edited");
    expect(response.body.data.comment.updatedAt).not.toBe(original.updatedAt);
  });

  it("forbids an admin from editing someone else's comment", async () => {
    const { dev, sam, task } = await setup({ samRole: "admin" });
    const created = await postComment(dev.cookies, task.id, {
      body: "Dev's comment",
    });
    const commentId = created.body.data.comment.id as string;

    const member = await patchComment(sam.cookies, commentId, {
      body: "Hijacked",
    });
    // Sam is an admin here: admins may delete but never edit.
    expect(member.status).toBe(403);
    expect(member.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects a plain member editing another member's comment", async () => {
    const { maya, dev, task } = await setup();
    const created = await postComment(dev.cookies, task.id, {
      body: "Dev's comment",
    });

    const response = await patchComment(
      maya.cookies,
      created.body.data.comment.id,
      {
        body: "Owner edit",
      },
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a missing comment and for non-members", async () => {
    const { maya, sam, task } = await setup();
    const created = await postComment(maya.cookies, task.id, { body: "Mine" });

    const missing = await patchComment(maya.cookies, MISSING_ID, {
      body: "Nowhere",
    });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("COMMENT_NOT_FOUND");

    const nonMember = await patchComment(
      sam.cookies,
      created.body.data.comment.id,
      {
        body: "Sneaky",
      },
    );
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe("COMMENT_NOT_FOUND");
  });
});

describe("DELETE /comments/:commentId", () => {
  it("lets the author delete their comment", async () => {
    const { dev, task } = await setup();
    const created = await postComment(dev.cookies, task.id, { body: "Mine" });
    const commentId = created.body.data.comment.id as string;

    const response = await deleteComment(dev.cookies, commentId);

    expect(response.status).toBe(204);
    const list = await listComments(dev.cookies, task.id);
    expect(list.body.data.comments).toEqual([]);
  });

  it("lets the owner and an admin delete another member's comment", async () => {
    const { maya, sam, dev, task } = await setup({ samRole: "admin" });
    const first = await postComment(dev.cookies, task.id, { body: "One" });
    const second = await postComment(dev.cookies, task.id, { body: "Two" });

    const ownerDelete = await deleteComment(
      maya.cookies,
      first.body.data.comment.id,
    );
    expect(ownerDelete.status).toBe(204);

    const adminDelete = await deleteComment(
      sam.cookies,
      second.body.data.comment.id,
    );
    expect(adminDelete.status).toBe(204);
  });

  it("forbids a plain member from deleting another member's comment", async () => {
    const { dev, maya, task } = await setup();
    const created = await postComment(maya.cookies, task.id, {
      body: "Maya's comment",
    });

    const response = await deleteComment(
      dev.cookies,
      created.body.data.comment.id,
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a non-member and a missing comment", async () => {
    const { maya, sam, task } = await setup();
    const created = await postComment(maya.cookies, task.id, { body: "Mine" });

    const nonMember = await deleteComment(
      sam.cookies,
      created.body.data.comment.id,
    );
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe("COMMENT_NOT_FOUND");

    const missing = await deleteComment(maya.cookies, MISSING_ID);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("COMMENT_NOT_FOUND");
  });
});

describe("comment counts", () => {
  it("reflects create and delete in task lists and details", async () => {
    const { dev, task, project } = await setup();

    const created = await postComment(dev.cookies, task.id, {
      body: "Count me",
    });
    const commentId = created.body.data.comment.id as string;

    const listAfterCreate = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks`)
      .set("Cookie", dev.cookies);
    expect(listAfterCreate.body.data.tasks[0].commentCount).toBe(1);

    const detailAfterCreate = await request(app)
      .get(`/api/v1/tasks/${task.id}`)
      .set("Cookie", dev.cookies);
    expect(detailAfterCreate.body.data.task.commentCount).toBe(1);

    await deleteComment(dev.cookies, commentId);

    const listAfterDelete = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks`)
      .set("Cookie", dev.cookies);
    expect(listAfterDelete.body.data.tasks[0].commentCount).toBe(0);

    const detailAfterDelete = await request(app)
      .get(`/api/v1/tasks/${task.id}`)
      .set("Cookie", dev.cookies);
    expect(detailAfterDelete.body.data.task.commentCount).toBe(0);
  });
});
