import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/client.js";
import {
  boardColumns,
  comments,
  notifications,
  projectMembers,
  projects,
  sessions,
  tasks,
  users,
} from "../../src/db/schema/index.js";
import { closeTestPool, resetDb } from "../helpers/db.js";

beforeEach(resetDb);
afterAll(closeTestPool);

describe("database schema", () => {
  it("cascades project deletion through the whole graph", async () => {
    const [maya] = await db
      .insert(users)
      .values({
        email: "maya@example.com",
        name: "Maya Chen",
        passwordHash: "hash",
      })
      .returning();
    const [dev] = await db
      .insert(users)
      .values({
        email: "dev@example.com",
        name: "Dev Patel",
        passwordHash: "hash",
      })
      .returning();

    const [project] = await db
      .insert(projects)
      .values({
        name: "Website",
        ownerId: maya.id,
      })
      .returning();
    await db.insert(projectMembers).values([
      { projectId: project.id, userId: maya.id, role: "owner" },
      { projectId: project.id, userId: dev.id, role: "member" },
    ]);
    const [column] = await db
      .insert(boardColumns)
      .values({
        projectId: project.id,
        name: "Backlog",
        position: 1024,
      })
      .returning();
    const [task] = await db
      .insert(tasks)
      .values({
        projectId: project.id,
        columnId: column.id,
        title: "Fix login",
        createdBy: maya.id,
        assigneeId: dev.id,
        position: 1024,
      })
      .returning();
    const [comment] = await db
      .insert(comments)
      .values({
        taskId: task.id,
        authorId: maya.id,
        body: "On it",
      })
      .returning();
    await db.insert(notifications).values({
      userId: dev.id,
      actorId: maya.id,
      type: "comment_added",
      projectId: project.id,
      taskId: task.id,
      commentId: comment.id,
    });
    await db.insert(sessions).values({
      userId: dev.id,
      tokenHash: "refresh-token-hash",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await db.delete(projects).where(eq(projects.id, project.id));

    await expect(db.select().from(projectMembers)).resolves.toHaveLength(0);
    await expect(db.select().from(boardColumns)).resolves.toHaveLength(0);
    await expect(db.select().from(tasks)).resolves.toHaveLength(0);
    await expect(db.select().from(comments)).resolves.toHaveLength(0);
    await expect(db.select().from(notifications)).resolves.toHaveLength(0);
    // Sessions belong to users, not projects, so a project delete must not touch them.
    await expect(db.select().from(sessions)).resolves.toHaveLength(1);
  });

  it("rejects duplicate emails and a second owner row", async () => {
    const [a] = await db
      .insert(users)
      .values({
        email: "a@example.com",
        name: "A",
        passwordHash: "h",
      })
      .returning();
    const [b] = await db
      .insert(users)
      .values({
        email: "b@example.com",
        name: "B",
        passwordHash: "h",
      })
      .returning();
    await expect(
      db.insert(users).values({
        email: "a@example.com",
        name: "A2",
        passwordHash: "h",
      }),
    ).rejects.toThrow();

    const [project] = await db
      .insert(projects)
      .values({ name: "P", ownerId: a.id })
      .returning();
    await db
      .insert(projectMembers)
      .values({ projectId: project.id, userId: a.id, role: "owner" });
    await expect(
      db.insert(projectMembers).values({
        projectId: project.id,
        userId: b.id,
        role: "owner",
      }),
    ).rejects.toThrow();
  });
});
