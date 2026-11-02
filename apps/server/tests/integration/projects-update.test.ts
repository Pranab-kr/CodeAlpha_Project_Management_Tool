import { asc, eq, sql } from "drizzle-orm";
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
  users,
} from "../../src/db/schema/index.js";
import { registerSession } from "../helpers/auth.js";
import { closeTestPool, resetDb } from "../helpers/db.js";

const app = createApp();

beforeEach(resetDb);
afterAll(closeTestPool);

async function createUser(email: string, name = "Test User") {
  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash: "hash" })
    .returning();
  return user;
}

async function addMembership(
  projectId: string,
  userId: string,
  role: "owner" | "admin" | "member" = "member",
) {
  await db.insert(projectMembers).values({ projectId, userId, role });
}

async function createProject(cookies: string, name = "Alpha") {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Cookie", cookies)
    .send({ name, description: "Original description" });
  expect(response.status).toBe(201);
  return response.body.data.project as {
    id: string;
    updatedAt: string;
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("PATCH /projects/:projectId", () => {
  it("updates name and description for the owner and moves updatedAt", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const project = await createProject(maya.cookies);
    await wait(10);

    const response = await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set("Cookie", maya.cookies)
      .send({ name: "  Renamed  ", description: "  New copy  " });

    expect(response.status).toBe(200);
    expect(response.body.data.project).toMatchObject({
      name: "Renamed",
      description: "New copy",
      role: "owner",
    });
    expect(
      new Date(response.body.data.project.updatedAt).getTime(),
    ).toBeGreaterThan(new Date(project.updatedAt).getTime());
  });

  it("lets an admin update but rejects a member", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);
    await addMembership(project.id, sam.user.id, "admin");
    await addMembership(project.id, dev.user.id, "member");

    const adminUpdate = await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set("Cookie", sam.cookies)
      .send({ description: "Admin copy" });
    expect(adminUpdate.status).toBe(200);
    expect(adminUpdate.body.data.project.description).toBe("Admin copy");

    const memberUpdate = await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set("Cookie", dev.cookies)
      .send({ name: "Member edit" });
    expect(memberUpdate.status).toBe(403);
    expect(memberUpdate.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a non-member and 422 for an empty body", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const project = await createProject(maya.cookies);

    const nonMember = await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set("Cookie", sam.cookies)
      .send({ name: "Hidden" });
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe("PROJECT_NOT_FOUND");

    const empty = await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set("Cookie", maya.cookies)
      .send({});
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /projects/:projectId", () => {
  it("deletes the project and cascades rows for the owner", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await createUser("dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);
    await addMembership(project.id, dev.id, "member");

    const [column] = await db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.projectId, project.id))
      .orderBy(asc(boardColumns.position))
      .limit(1);
    const [task] = await db
      .insert(tasks)
      .values({
        projectId: project.id,
        columnId: column.id,
        title: "Delete me",
        description: "",
        assigneeId: dev.id,
        createdBy: maya.user.id,
        position: 1024,
      })
      .returning();
    await db.insert(comments).values({
      taskId: task.id,
      authorId: dev.id,
      body: "A comment",
    });
    await db.insert(notifications).values({
      userId: dev.id,
      actorId: maya.user.id,
      type: "task_assigned",
      projectId: project.id,
      taskId: task.id,
    });

    const response = await request(app)
      .delete(`/api/v1/projects/${project.id}`)
      .set("Cookie", maya.cookies);
    expect(response.status).toBe(204);

    const [projectCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.id, project.id));
    const [memberCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, project.id));
    const [columnCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(boardColumns)
      .where(eq(boardColumns.projectId, project.id));
    const [taskCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.projectId, project.id));
    expect(projectCount.count).toBe(0);
    expect(memberCount.count).toBe(0);
    expect(columnCount.count).toBe(0);
    expect(taskCount.count).toBe(0);
    const [commentCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments);
    const [notificationCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications);
    expect(commentCount.count).toBe(0);
    expect(notificationCount.count).toBe(0);
  });

  it("rejects admins and members", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);
    await addMembership(project.id, sam.user.id, "admin");
    await addMembership(project.id, dev.user.id, "member");

    for (const session of [sam, dev]) {
      const response = await request(app)
        .delete(`/api/v1/projects/${project.id}`)
        .set("Cookie", session.cookies);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("returns 404 for a non-member and 401 anonymously", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const project = await createProject(maya.cookies);

    const nonMember = await request(app)
      .delete(`/api/v1/projects/${project.id}`)
      .set("Cookie", sam.cookies);
    expect(nonMember.status).toBe(404);

    const anonymous = await request(app).delete(
      `/api/v1/projects/${project.id}`,
    );
    expect(anonymous.status).toBe(401);
  });
});
