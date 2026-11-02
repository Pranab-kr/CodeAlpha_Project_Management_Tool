import { asc, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import {
  boardColumns,
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

async function createProject(cookies: string, name: string, description = "") {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Cookie", cookies)
    .send({ name, description });
  expect(response.status).toBe(201);
  return response.body.data.project as { id: string; columns: unknown[] };
}

async function insertTask(projectId: string, columnId: string, title: string) {
  await db.insert(tasks).values({
    projectId,
    columnId,
    title,
    description: "",
    createdBy: (await db.select({ id: users.id }).from(users).limit(1))[0].id,
    position: 1024,
  });
}

describe("GET /projects", () => {
  it("lists only the caller's projects with role, counts, and a member preview", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");

    const project = await createProject(
      maya.cookies,
      "Website Redesign",
      "Refresh the marketing site",
    );
    await addMembership(project.id, dev.user.id);
    for (let index = 0; index < 4; index += 1) {
      const user = await createUser(
        `member${index}@example.com`,
        `Member ${index}`,
      );
      await addMembership(project.id, user.id);
    }

    // A second project where Maya is not a member must stay hidden.
    await createProject(dev.cookies, "Mobile App Launch");

    const [backendColumn] = await db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.projectId, project.id))
      .orderBy(asc(boardColumns.position))
      .limit(1);
    await insertTask(project.id, backendColumn.id, "Audit navigation");
    await insertTask(project.id, backendColumn.id, "Write copy");

    const response = await request(app)
      .get("/api/v1/projects")
      .set("Cookie", maya.cookies);

    expect(response.status).toBe(200);
    expect(response.body.data.projects).toHaveLength(1);
    const [item] = response.body.data.projects;
    expect(item).toMatchObject({
      id: project.id,
      name: "Website Redesign",
      description: "Refresh the marketing site",
      role: "owner",
      memberCount: 6,
      taskCount: 2,
    });
    expect(item.members).toHaveLength(4);
    expect(
      item.members.some(
        (member: { id: string; initials: string }) =>
          member.id === maya.user.id && member.initials === "MC",
      ),
    ).toBe(true);

    const asDev = await request(app)
      .get("/api/v1/projects")
      .set("Cookie", dev.cookies);
    expect(asDev.body.data.projects).toHaveLength(2);
    expect(
      asDev.body.data.projects.find(
        (entry: { id: string }) => entry.id === project.id,
      ),
    ).toMatchObject({ role: "member" });
  });

  it("returns an empty list for a user with no projects", async () => {
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const response = await request(app)
      .get("/api/v1/projects")
      .set("Cookie", sam.cookies);
    expect(response.status).toBe(200);
    expect(response.body.data.projects).toEqual([]);
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/projects");
    expect(response.status).toBe(401);
  });
});

describe("POST /projects", () => {
  it("creates one owner row and the three default columns in one transaction", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const response = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", maya.cookies)
      .send({ name: "  Phase 2 Demo  " });

    expect(response.status).toBe(201);
    const project = response.body.data.project;
    expect(project).toMatchObject({
      name: "Phase 2 Demo",
      description: "",
      ownerId: maya.user.id,
      role: "owner",
      memberCount: 1,
      taskCount: 0,
    });
    expect(
      project.columns.map((column: { name: string }) => column.name),
    ).toEqual(["Backlog", "In Progress", "Done"]);

    const members = await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, project.id));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      userId: maya.user.id,
      role: "owner",
    });

    const columns = await db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.projectId, project.id))
      .orderBy(asc(boardColumns.position));
    expect(columns.map((column) => [column.name, column.position])).toEqual([
      ["Backlog", 1024],
      ["In Progress", 2048],
      ["Done", 3072],
    ]);
  });

  it("validates the body and rejects a whitespace-only name", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const response = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", maya.cookies)
      .send({ name: "   " });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fieldErrors).toBeTruthy();
  });

  it("requires authentication", async () => {
    const response = await request(app)
      .post("/api/v1/projects")
      .send({ name: "Anonymous" });
    expect(response.status).toBe(401);
  });
});

describe("GET /projects/:projectId", () => {
  it("returns members and columns to a member", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const dev = await registerSession(app, "dev@example.com", "Dev Patel");
    const project = await createProject(maya.cookies, "Alpha");
    await addMembership(project.id, dev.user.id);

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}`)
      .set("Cookie", dev.cookies);

    expect(response.status).toBe(200);
    expect(response.body.data.project).toMatchObject({
      id: project.id,
      name: "Alpha",
      role: "member",
      memberCount: 2,
      taskCount: 0,
    });
    expect(response.body.data.project.members).toHaveLength(2);
    expect(response.body.data.project.columns).toHaveLength(3);
  });

  it("hides a project from a signed-in non-member with 404", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const project = await createProject(maya.cookies, "Private");

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}`)
      .set("Cookie", sam.cookies);

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: "PROJECT_NOT_FOUND",
      message: "Project not found",
    });
  });

  it("returns 404 for a missing project and 422 for a malformed id", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const missing = await request(app)
      .get("/api/v1/projects/00000000-0000-4000-8000-000000000000")
      .set("Cookie", maya.cookies);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("PROJECT_NOT_FOUND");

    const malformed = await request(app)
      .get("/api/v1/projects/not-a-uuid")
      .set("Cookie", maya.cookies);
    expect(malformed.status).toBe(422);
    expect(malformed.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires authentication", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const project = await createProject(maya.cookies, "Alpha");
    const response = await request(app).get(`/api/v1/projects/${project.id}`);
    expect(response.status).toBe(401);
  });

  it("matches row counts and orders members by role then name", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const project = await createProject(maya.cookies, "Ordering");
    const zoe = await createUser("zoe@example.com", "Zoe Adams");
    const amy = await createUser("amy@example.com", "Amy Bell");
    const dev = await createUser("dev2@example.com", "Dev Patel");
    await addMembership(project.id, zoe.id, "admin");
    await addMembership(project.id, amy.id, "member");
    await addMembership(project.id, dev.id, "member");

    const columns = await db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.projectId, project.id))
      .orderBy(asc(boardColumns.position));
    await insertTask(project.id, columns[0].id, "One");
    await insertTask(project.id, columns[1].id, "Two");

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}`)
      .set("Cookie", maya.cookies);

    expect(response.status).toBe(200);
    const detail = response.body.data.project;
    expect(detail.memberCount).toBe(4);
    expect(detail.taskCount).toBe(2);
    expect(
      detail.members.map((member: { name: string; role: string }) => [
        member.name,
        member.role,
      ]),
    ).toEqual([
      ["Maya Chen", "owner"],
      ["Zoe Adams", "admin"],
      ["Amy Bell", "member"],
      ["Dev Patel", "member"],
    ]);
    expect(
      detail.columns.map((column: { position: number }) => column.position),
    ).toEqual([1024, 2048, 3072]);
  });
});

describe("project listing ordering", () => {
  it("orders projects by updatedAt descending with an id tiebreaker", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const first = await createProject(maya.cookies, "First");
    const second = await createProject(maya.cookies, "Second");
    await db
      .update(projects)
      .set({ updatedAt: new Date("2026-01-01T00:00:00.000Z") })
      .where(eq(projects.id, first.id));
    await db
      .update(projects)
      .set({ updatedAt: new Date("2026-01-02T00:00:00.000Z") })
      .where(eq(projects.id, second.id));

    const response = await request(app)
      .get("/api/v1/projects")
      .set("Cookie", maya.cookies);
    expect(response.status).toBe(200);
    expect(
      response.body.data.projects.map((entry: { name: string }) => entry.name),
    ).toEqual(["Second", "First"]);
  });
});
