import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import {
  boardColumns,
  notifications,
  projectMembers,
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
    .send({ name });
  expect(response.status).toBe(201);
  return response.body.data.project as { id: string };
}

describe("POST /projects/:projectId/members", () => {
  it("adds an existing user by normalized email as a member", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/members`)
      .set("Cookie", maya.cookies)
      .send({ email: "  DEV@Example.COM " });

    expect(response.status).toBe(201);
    expect(response.body.data.member).toMatchObject({
      userId: dev.user.id,
      email: "dev@example.com",
      name: "Dev Patel",
      initials: "DP",
      role: "member",
    });
  });

  it("lets an admin add a member", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);
    await addMembership(project.id, sam.user.id, "admin");

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/members`)
      .set("Cookie", sam.cookies)
      .send({ email: dev.user.email });

    expect(response.status).toBe(201);
    expect(response.body.data.member.role).toBe("member");
  });

  it("returns 404 for an unknown email and 409 for a duplicate member", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);

    const unknown = await request(app)
      .post(`/api/v1/projects/${project.id}/members`)
      .set("Cookie", maya.cookies)
      .send({ email: "nobody@example.com" });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("USER_NOT_FOUND");

    await request(app)
      .post(`/api/v1/projects/${project.id}/members`)
      .set("Cookie", maya.cookies)
      .send({ email: dev.user.email })
      .expect(201);

    const duplicate = await request(app)
      .post(`/api/v1/projects/${project.id}/members`)
      .set("Cookie", maya.cookies)
      .send({ email: dev.user.email });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("ALREADY_MEMBER");
  });

  it("rejects a member and a non-member", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const project = await createProject(maya.cookies);
    await addMembership(project.id, dev.user.id, "member");

    const asMember = await request(app)
      .post(`/api/v1/projects/${project.id}/members`)
      .set("Cookie", dev.cookies)
      .send({ email: sam.user.email });
    expect(asMember.status).toBe(403);

    const asOutsider = await request(app)
      .post(`/api/v1/projects/${project.id}/members`)
      .set("Cookie", sam.cookies)
      .send({ email: dev.user.email });
    expect(asOutsider.status).toBe(404);
    expect(asOutsider.body.error.code).toBe("PROJECT_NOT_FOUND");
  });
});

describe("PATCH /projects/:projectId/members/:userId", () => {
  it("promotes and demotes a member as the owner", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);
    await addMembership(project.id, dev.user.id, "member");

    const promote = await request(app)
      .patch(`/api/v1/projects/${project.id}/members/${dev.user.id}`)
      .set("Cookie", maya.cookies)
      .send({ role: "admin" });
    expect(promote.status).toBe(200);
    expect(promote.body.data.member).toMatchObject({
      userId: dev.user.id,
      role: "admin",
    });

    const demote = await request(app)
      .patch(`/api/v1/projects/${project.id}/members/${dev.user.id}`)
      .set("Cookie", maya.cookies)
      .send({ role: "member" });
    expect(demote.status).toBe(200);
    expect(demote.body.data.member.role).toBe("member");
  });

  it("protects the owner role and rejects admins", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);
    await addMembership(project.id, sam.user.id, "admin");
    await addMembership(project.id, dev.user.id, "member");

    const demoteOwner = await request(app)
      .patch(`/api/v1/projects/${project.id}/members/${maya.user.id}`)
      .set("Cookie", maya.cookies)
      .send({ role: "member" });
    expect(demoteOwner.status).toBe(409);
    expect(demoteOwner.body.error.code).toBe("CANNOT_CHANGE_OWNER_ROLE");

    const adminChange = await request(app)
      .patch(`/api/v1/projects/${project.id}/members/${dev.user.id}`)
      .set("Cookie", sam.cookies)
      .send({ role: "admin" });
    expect(adminChange.status).toBe(403);
    expect(adminChange.body.error.code).toBe("FORBIDDEN");

    const missing = await request(app)
      .patch(
        `/api/v1/projects/${project.id}/members/00000000-0000-4000-8000-000000000000`,
      )
      .set("Cookie", maya.cookies)
      .send({ role: "admin" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("MEMBER_NOT_FOUND");
  });
});

describe("DELETE /projects/:projectId/members/:userId", () => {
  it("unassigns tasks and deletes only that project's notifications", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const projectA = await createProject(maya.cookies, "Alpha");
    const projectB = await createProject(maya.cookies, "Beta");
    await addMembership(projectA.id, dev.user.id);
    await addMembership(projectB.id, dev.user.id);

    const [column] = await db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.projectId, projectA.id))
      .limit(1);
    const [task] = await db
      .insert(tasks)
      .values({
        projectId: projectA.id,
        columnId: column.id,
        title: "Assigned work",
        description: "",
        assigneeId: dev.user.id,
        createdBy: maya.user.id,
        position: 1024,
      })
      .returning();
    await db.insert(notifications).values([
      {
        userId: dev.user.id,
        actorId: maya.user.id,
        type: "task_assigned",
        projectId: projectA.id,
        taskId: task.id,
      },
      {
        userId: dev.user.id,
        actorId: maya.user.id,
        type: "task_assigned",
        projectId: projectB.id,
      },
    ]);

    const response = await request(app)
      .delete(`/api/v1/projects/${projectA.id}/members/${dev.user.id}`)
      .set("Cookie", maya.cookies);
    expect(response.status).toBe(204);

    const [updatedTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, task.id));
    expect(updatedTask.assigneeId).toBeNull();

    const remainingA = await db
      .select()
      .from(notifications)
      .where(eq(notifications.projectId, projectA.id));
    const remainingB = await db
      .select()
      .from(notifications)
      .where(eq(notifications.projectId, projectB.id));
    expect(remainingA).toHaveLength(0);
    expect(remainingB).toHaveLength(1);

    const membership = await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectA.id));
    expect(membership.map((row) => row.userId)).not.toContain(dev.user.id);
  });

  it("allows admins to remove members but not other admins", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const zoe = await registerSession(app, "zoe@example.com", "Zoe Adams");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);
    await addMembership(project.id, sam.user.id, "admin");
    await addMembership(project.id, zoe.user.id, "admin");
    await addMembership(project.id, dev.user.id, "member");

    const adminRemovesAdmin = await request(app)
      .delete(`/api/v1/projects/${project.id}/members/${zoe.user.id}`)
      .set("Cookie", sam.cookies);
    expect(adminRemovesAdmin.status).toBe(403);

    const memberRemovesMember = await request(app)
      .delete(`/api/v1/projects/${project.id}/members/${zoe.user.id}`)
      .set("Cookie", dev.cookies);
    expect(memberRemovesMember.status).toBe(403);

    const adminRemovesMember = await request(app)
      .delete(`/api/v1/projects/${project.id}/members/${dev.user.id}`)
      .set("Cookie", sam.cookies);
    expect(adminRemovesMember.status).toBe(204);
  });

  it("lets members leave and protects the owner", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies);
    await addMembership(project.id, dev.user.id);

    const leave = await request(app)
      .delete(`/api/v1/projects/${project.id}/members/${dev.user.id}`)
      .set("Cookie", dev.cookies);
    expect(leave.status).toBe(204);

    const ownerLeaves = await request(app)
      .delete(`/api/v1/projects/${project.id}/members/${maya.user.id}`)
      .set("Cookie", maya.cookies);
    expect(ownerLeaves.status).toBe(409);
    expect(ownerLeaves.body.error.code).toBe("CANNOT_REMOVE_OWNER");
  });

  it("returns 404 for non-members on every member route", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const project = await createProject(maya.cookies);

    const list = await request(app)
      .get(`/api/v1/projects/${project.id}/members`)
      .set("Cookie", sam.cookies);
    expect(list.status).toBe(404);
    expect(list.body.error.code).toBe("PROJECT_NOT_FOUND");

    const remove = await request(app)
      .delete(`/api/v1/projects/${project.id}/members/${sam.user.id}`)
      .set("Cookie", sam.cookies);
    expect(remove.status).toBe(404);
    expect(remove.body.error.code).toBe("PROJECT_NOT_FOUND");
  });
});

describe("GET /projects/:projectId/members", () => {
  it("orders owners first, then admins, then members, each by name", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const project = await createProject(maya.cookies);
    const adam = await createUser("adam@example.com", "Adam Admin");
    const zoe = await createUser("zoe@example.com", "Zoe Admin");
    const amy = await createUser("amy@example.com", "Amy Member");
    const dev = await createUser("dev@example.com", "Dev Member");
    await addMembership(project.id, adam.id, "admin");
    await addMembership(project.id, zoe.id, "admin");
    await addMembership(project.id, amy.id, "member");
    await addMembership(project.id, dev.id, "member");

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}/members`)
      .set("Cookie", maya.cookies);

    expect(response.status).toBe(200);
    expect(
      response.body.data.members.map((member: { name: string }) => member.name),
    ).toEqual([
      "Maya Chen",
      "Adam Admin",
      "Zoe Admin",
      "Amy Member",
      "Dev Member",
    ]);
  });

  it("requires authentication", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const project = await createProject(maya.cookies);
    const response = await request(app).get(
      `/api/v1/projects/${project.id}/members`,
    );
    expect(response.status).toBe(401);
  });
});
