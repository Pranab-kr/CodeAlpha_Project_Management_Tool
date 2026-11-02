import { asc, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import {
  boardColumns,
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

function projectColumns(projectId: string) {
  return db
    .select()
    .from(boardColumns)
    .where(eq(boardColumns.projectId, projectId))
    .orderBy(asc(boardColumns.position));
}

async function setupMemberProject() {
  const maya = await registerSession(app, "maya@example.com", "Maya Chen");
  const dev = await registerSession(app, "dev@example.com", "Dev Patel");
  const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
  const project = await createProject(maya.cookies);
  await addMembership(project.id, dev.user.id, "member");
  await addMembership(project.id, sam.user.id, "admin");
  return { maya, dev, sam, project };
}

function createColumn(cookies: string, projectId: string, name: string) {
  return request(app)
    .post(`/api/v1/projects/${projectId}/columns`)
    .set("Cookie", cookies)
    .send({ name });
}

describe("POST /projects/:projectId/columns", () => {
  it("appends a column at max + 1024 for the owner", async () => {
    const { maya, project } = await setupMemberProject();

    const response = await createColumn(maya.cookies, project.id, "  Review  ");

    expect(response.status).toBe(201);
    expect(response.body.data.column).toMatchObject({
      projectId: project.id,
      name: "Review",
      position: 4096,
    });

    const columns = await projectColumns(project.id);
    expect(columns.map((column) => [column.name, column.position])).toEqual([
      ["Backlog", 1024],
      ["In Progress", 2048],
      ["Done", 3072],
      ["Review", 4096],
    ]);
  });

  it("lets an admin create, rename, reorder, and delete columns", async () => {
    const { sam, project } = await setupMemberProject();

    const created = await createColumn(sam.cookies, project.id, "QA");
    expect(created.status).toBe(201);
    const columnId = created.body.data.column.id as string;

    const renamed = await request(app)
      .patch(`/api/v1/columns/${columnId}`)
      .set("Cookie", sam.cookies)
      .send({ name: "  Quality  " });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.column.name).toBe("Quality");

    const ids = [...project.columns.map((column) => column.id), columnId];
    const reordered = await request(app)
      .patch(`/api/v1/projects/${project.id}/columns/reorder`)
      .set("Cookie", sam.cookies)
      .send({ columnIds: [ids[3], ids[0], ids[1], ids[2]] });
    expect(reordered.status).toBe(200);
    expect(
      reordered.body.data.columns.map(
        (column: { name: string }) => column.name,
      ),
    ).toEqual(["Quality", "Backlog", "In Progress", "Done"]);

    const deleted = await request(app)
      .delete(`/api/v1/columns/${columnId}`)
      .set("Cookie", sam.cookies);
    expect(deleted.status).toBe(204);

    const remaining = await projectColumns(project.id);
    expect(remaining).toHaveLength(3);
    expect(remaining.map((column) => column.name)).toEqual([
      "Backlog",
      "In Progress",
      "Done",
    ]);
    // Deleting a column leaves gaps; ordering reads positions, so no renumber.
    expect(remaining.map((column) => column.position)).toEqual([
      2048, 3072, 4096,
    ]);
  });

  it("rejects members on every column mutation", async () => {
    const { dev, project } = await setupMemberProject();
    const columnId = project.columns[0].id;

    const create = await createColumn(dev.cookies, project.id, "Member column");
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe("FORBIDDEN");

    const update = await request(app)
      .patch(`/api/v1/columns/${columnId}`)
      .set("Cookie", dev.cookies)
      .send({ name: "Member rename" });
    expect(update.status).toBe(403);

    const reorder = await request(app)
      .patch(`/api/v1/projects/${project.id}/columns/reorder`)
      .set("Cookie", dev.cookies)
      .send({ columnIds: project.columns.map((column) => column.id) });
    expect(reorder.status).toBe(403);

    const remove = await request(app)
      .delete(`/api/v1/columns/${columnId}`)
      .set("Cookie", dev.cookies);
    expect(remove.status).toBe(403);
  });

  it("hides project routes from non-members with PROJECT_NOT_FOUND", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const project = await createProject(maya.cookies);

    const create = await createColumn(sam.cookies, project.id, "Hidden");
    expect(create.status).toBe(404);
    expect(create.body.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("requires authentication", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const project = await createProject(maya.cookies);
    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/columns`)
      .send({ name: "Anonymous" });
    expect(response.status).toBe(401);
  });

  it("validates the name length and trims it", async () => {
    const { maya, project } = await setupMemberProject();
    for (const name of ["   ", "x".repeat(61)]) {
      const response = await createColumn(maya.cookies, project.id, name);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("PATCH /columns/:columnId", () => {
  it("validates the new name", async () => {
    const { maya, project } = await setupMemberProject();
    const invalid = await request(app)
      .patch(`/api/v1/columns/${project.columns[0].id}`)
      .set("Cookie", maya.cookies)
      .send({ name: " " });
    expect(invalid.status).toBe(422);
  });

  it("returns COLUMN_NOT_FOUND to non-members and for missing columns", async () => {
    const maya = await registerSession(app, "maya@example.com", "Maya Chen");
    const sam = await registerSession(app, "sam@example.com", "Sam Rivera");
    const project = await createProject(maya.cookies);
    const columnId = project.columns[0].id;

    const nonMember = await request(app)
      .patch(`/api/v1/columns/${columnId}`)
      .set("Cookie", sam.cookies)
      .send({ name: "Hidden" });
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe("COLUMN_NOT_FOUND");

    const missing = await request(app)
      .patch("/api/v1/columns/00000000-0000-4000-8000-000000000000")
      .set("Cookie", maya.cookies)
      .send({ name: "Missing" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("COLUMN_NOT_FOUND");
  });
});

describe("PATCH /projects/:projectId/columns/reorder", () => {
  it("applies an exact permutation with fresh 1024 positions", async () => {
    const { maya, project } = await setupMemberProject();
    const ids = project.columns.map((column) => column.id);

    const response = await request(app)
      .patch(`/api/v1/projects/${project.id}/columns/reorder`)
      .set("Cookie", maya.cookies)
      .send({ columnIds: [ids[2], ids[0], ids[1]] });

    expect(response.status).toBe(200);
    expect(
      response.body.data.columns.map(
        (column: { name: string; position: number }) => [
          column.name,
          column.position,
        ],
      ),
    ).toEqual([
      ["Done", 1024],
      ["Backlog", 2048],
      ["In Progress", 3072],
    ]);

    const detail = await request(app)
      .get(`/api/v1/projects/${project.id}`)
      .set("Cookie", maya.cookies);
    expect(
      detail.body.data.project.columns.map(
        (column: { name: string }) => column.name,
      ),
    ).toEqual(["Done", "Backlog", "In Progress"]);
  });

  it("rejects duplicates, omissions, and foreign columns", async () => {
    const { maya, project } = await setupMemberProject();
    const ids = project.columns.map((column) => column.id);

    const duplicate = await request(app)
      .patch(`/api/v1/projects/${project.id}/columns/reorder`)
      .set("Cookie", maya.cookies)
      .send({ columnIds: [ids[0], ids[0], ids[1]] });
    expect(duplicate.status).toBe(422);
    expect(duplicate.body.error.code).toBe("INVALID_COLUMN_ORDER");

    const omitted = await request(app)
      .patch(`/api/v1/projects/${project.id}/columns/reorder`)
      .set("Cookie", maya.cookies)
      .send({ columnIds: [ids[0], ids[1]] });
    expect(omitted.status).toBe(422);
    expect(omitted.body.error.code).toBe("INVALID_COLUMN_ORDER");

    const other = await createProject(maya.cookies, "Other");
    const foreign = await request(app)
      .patch(`/api/v1/projects/${project.id}/columns/reorder`)
      .set("Cookie", maya.cookies)
      .send({ columnIds: [ids[0], ids[1], other.columns[0].id] });
    expect(foreign.status).toBe(422);
    expect(foreign.body.error.code).toBe("INVALID_COLUMN_ORDER");
  });
});

describe("DELETE /columns/:columnId", () => {
  it("refuses a non-empty column and deletes an empty one", async () => {
    const { maya, project } = await setupMemberProject();
    const columnId = project.columns[0].id;

    await db.insert(tasks).values({
      projectId: project.id,
      columnId,
      title: "Occupied",
      description: "",
      createdBy: maya.user.id,
      position: 1024,
    });

    const blocked = await request(app)
      .delete(`/api/v1/columns/${columnId}`)
      .set("Cookie", maya.cookies);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("COLUMN_NOT_EMPTY");

    const stillThere = await db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.id, columnId));
    expect(stillThere).toHaveLength(1);

    const emptyColumnId = project.columns[2].id;
    const deleted = await request(app)
      .delete(`/api/v1/columns/${emptyColumnId}`)
      .set("Cookie", maya.cookies);
    expect(deleted.status).toBe(204);
  });

  it("returns 404 for a missing column", async () => {
    const { maya } = await setupMemberProject();
    const response = await request(app)
      .delete("/api/v1/columns/00000000-0000-4000-8000-000000000000")
      .set("Cookie", maya.cookies);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("COLUMN_NOT_FOUND");
  });
});

describe("concurrent column creation", () => {
  it("assigns distinct positions when ten creates race", async () => {
    const { maya, project } = await setupMemberProject();

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createColumn(maya.cookies, project.id, `Column ${index}`),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(201);
    }
    const positions = responses.map(
      (response) => response.body.data.column.position as number,
    );
    expect(new Set(positions).size).toBe(10);

    const columns = await projectColumns(project.id);
    expect(columns).toHaveLength(13);
    const stored = columns.map((column) => column.position);
    expect(new Set(stored).size).toBe(13);
    expect([...stored].sort((a, b) => a - b)).toEqual(stored);
  });
});
