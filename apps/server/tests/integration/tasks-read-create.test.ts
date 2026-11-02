import { asc, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import {
  boardColumns,
  comments,
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
    columns: { id: string; name: string; position: number }[];
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
  return { maya, dev, sam, project };
}

function createTask(
  cookies: string,
  projectId: string,
  body: Record<string, unknown>,
) {
  return request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set("Cookie", cookies)
    .send(body);
}

async function insertTask(input: {
  projectId: string;
  columnId: string;
  createdBy: string;
  title: string;
  position: number;
  assigneeId?: string;
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
    })
    .returning();
  return task;
}

describe("GET /projects/:projectId/tasks", () => {
  it("orders by column then task position and includes summaries and comment counts", async () => {
    const { maya, dev, project } = await setup();
    const [backlog, doing] = project.columns;

    const first = await insertTask({
      projectId: project.id,
      columnId: backlog.id,
      createdBy: maya.user.id,
      title: "Backlog first",
      position: 1024,
      assigneeId: dev.user.id,
    });
    await insertTask({
      projectId: project.id,
      columnId: backlog.id,
      createdBy: maya.user.id,
      title: "Backlog second",
      position: 2048,
    });
    await insertTask({
      projectId: project.id,
      columnId: doing.id,
      createdBy: maya.user.id,
      title: "Doing",
      position: 1024,
    });
    await db.insert(comments).values([
      { taskId: first.id, authorId: dev.user.id, body: "First comment" },
      { taskId: first.id, authorId: maya.user.id, body: "Second comment" },
    ]);

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks`)
      .set("Cookie", dev.cookies);

    expect(response.status).toBe(200);
    const list = response.body.data.tasks as Array<Record<string, unknown>>;
    expect(list.map((task) => task.title)).toEqual([
      "Backlog first",
      "Backlog second",
      "Doing",
    ]);
    expect(list[0]).toMatchObject({
      commentCount: 2,
      assignee: {
        id: dev.user.id,
        name: "Dev Patel",
        initials: "DP",
      },
      createdBy: {
        id: maya.user.id,
        name: "Maya Chen",
        initials: "MC",
      },
    });
    expect(list[1]).toMatchObject({ commentCount: 0, assignee: null });
    expect(list[0]).not.toHaveProperty("description");
  });
});

describe("POST /projects/:projectId/tasks", () => {
  it("appends to the column and returns the full detail", async () => {
    const { maya, dev, project } = await setup();
    const [backlog] = project.columns;

    const first = await createTask(maya.cookies, project.id, {
      columnId: backlog.id,
      title: "  First task  ",
      description: "Details here",
      priority: "high",
      dueDate: "2026-11-15",
      assigneeId: dev.user.id,
    });

    expect(first.status).toBe(201);
    expect(first.body.data.task).toMatchObject({
      projectId: project.id,
      columnId: backlog.id,
      title: "First task",
      description: "Details here",
      priority: "high",
      dueDate: "2026-11-15",
      position: 1024,
      commentCount: 0,
      assignee: { id: dev.user.id, initials: "DP" },
      createdBy: { id: maya.user.id, initials: "MC" },
    });

    const second = await createTask(maya.cookies, project.id, {
      columnId: backlog.id,
      title: "Second task",
    });
    expect(second.status).toBe(201);
    expect(second.body.data.task.position).toBe(2048);
    expect(second.body.data.task.priority).toBe("medium");
    expect(second.body.data.task.description).toBe("");
  });

  it("rejects a column from another project", async () => {
    const { maya, project } = await setup();
    const other = await createProject(maya.cookies, "Other");

    const response = await createTask(maya.cookies, project.id, {
      columnId: other.columns[0].id,
      title: "Wrong board",
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("INVALID_COLUMN");
  });

  it("rejects an assignee who is not a project member", async () => {
    const { maya, sam, project } = await setup();

    const response = await createTask(maya.cookies, project.id, {
      columnId: project.columns[0].id,
      title: "Wrong assignee",
      assigneeId: sam.user.id,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("INVALID_ASSIGNEE");
  });

  it("validates titles, dates, and ids", async () => {
    const { maya, project } = await setup();
    const columnId = project.columns[0].id;

    for (const body of [
      { columnId, title: "   " },
      { columnId, title: "x".repeat(201) },
      { columnId, title: "Bad date", dueDate: "2026-13-40" },
      { columnId: "not-a-uuid", title: "Bad column" },
    ]) {
      const response = await createTask(maya.cookies, project.id, body);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns 404 to non-members and 401 anonymously", async () => {
    const { sam, project } = await setup();

    const list = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks`)
      .set("Cookie", sam.cookies);
    expect(list.status).toBe(404);
    expect(list.body.error.code).toBe("PROJECT_NOT_FOUND");

    const create = await createTask(sam.cookies, project.id, {
      columnId: project.columns[0].id,
      title: "Hidden",
    });
    expect(create.status).toBe(404);
    expect(create.body.error.code).toBe("PROJECT_NOT_FOUND");

    const anonymous = await request(app).get(
      `/api/v1/projects/${project.id}/tasks`,
    );
    expect(anonymous.status).toBe(401);

    const anonymousCreate = await request(app)
      .post(`/api/v1/projects/${project.id}/tasks`)
      .send({ columnId: project.columns[0].id, title: "Anonymous" });
    expect(anonymousCreate.status).toBe(401);

    const anonymousDetail = await request(app).get(
      "/api/v1/tasks/00000000-0000-4000-8000-000000000000",
    );
    expect(anonymousDetail.status).toBe(401);
  });
});

describe("GET /tasks/:taskId", () => {
  it("returns the detail with a live comment count to any member", async () => {
    const { maya, dev, project } = await setup();
    const task = await insertTask({
      projectId: project.id,
      columnId: project.columns[0].id,
      createdBy: maya.user.id,
      title: "Detail task",
      position: 1024,
    });
    await db.insert(comments).values([
      { taskId: task.id, authorId: dev.user.id, body: "One" },
      { taskId: task.id, authorId: maya.user.id, body: "Two" },
    ]);

    const response = await request(app)
      .get(`/api/v1/tasks/${task.id}`)
      .set("Cookie", dev.cookies);

    expect(response.status).toBe(200);
    expect(response.body.data.task).toMatchObject({
      id: task.id,
      title: "Detail task",
      description: "Detail task description",
      commentCount: 2,
    });
  });

  it("returns 404 to non-members and for missing tasks", async () => {
    const { maya, sam, project } = await setup();
    const task = await insertTask({
      projectId: project.id,
      columnId: project.columns[0].id,
      createdBy: maya.user.id,
      title: "Private",
      position: 1024,
    });

    const nonMember = await request(app)
      .get(`/api/v1/tasks/${task.id}`)
      .set("Cookie", sam.cookies);
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe("TASK_NOT_FOUND");

    const missing = await request(app)
      .get("/api/v1/tasks/00000000-0000-4000-8000-000000000000")
      .set("Cookie", maya.cookies);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("TASK_NOT_FOUND");
  });
});

describe("concurrent task creation", () => {
  it("assigns distinct positions when ten creates race in one column", async () => {
    const { maya, project } = await setup();
    const columnId = project.columns[0].id;

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createTask(maya.cookies, project.id, {
          columnId,
          title: `Task ${index}`,
        }),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(201);
    }
    const positions = responses.map(
      (response) => response.body.data.task.position as number,
    );
    expect(new Set(positions).size).toBe(10);

    const stored = await db
      .select({ position: tasks.position })
      .from(tasks)
      .where(eq(tasks.columnId, columnId))
      .orderBy(asc(tasks.position));
    expect(stored).toHaveLength(10);
    expect(new Set(stored.map((row) => row.position)).size).toBe(10);
  });

  it("keeps the seeded board readable", async () => {
    const { project } = await setup();
    const columns = await db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.projectId, project.id));
    expect(columns).toHaveLength(3);
  });
});
