import type { CreateTaskInput, TaskCard, TaskDetail } from "@teamboard/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../../db/client.js";
import {
  boardColumns,
  comments,
  tasks,
  users,
  type SelectTask,
  type SelectUser,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { appendPosition } from "../../lib/ordering.js";
import {
  getMembership,
  requireMembership,
} from "../projects/projects.permissions.js";
import { toTaskCard, toTaskDetail, type TaskRow } from "./tasks.mapper.js";
import { requireTaskContext } from "./tasks.permissions.js";

// Qualified names again: an unqualified `"id"` in a correlated subquery binds
// to the inner table and silently counts zero rows.
const commentCountSql = sql<number>`(
  select count(*)::int from "comments"
  where "comments"."task_id" = "tasks"."id"
)`;

async function loadUsers(
  ids: string[],
  executor: DbExecutor = db,
): Promise<Map<string, SelectUser>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await executor
    .select()
    .from(users)
    .where(inArray(users.id, unique));
  return new Map(rows.map((user) => [user.id, user]));
}

function buildRow(
  task: SelectTask,
  commentCount: number,
  usersById: Map<string, SelectUser>,
): TaskRow {
  const creator = usersById.get(task.createdBy);
  if (!creator) {
    // created_by is FK-restricted, so this can only be a broken invariant.
    throw new Error("Task creator is missing");
  }
  const assignee = task.assigneeId
    ? (usersById.get(task.assigneeId) ?? null)
    : null;
  return { task, commentCount, assignee, creator };
}

export async function listTasks(
  projectId: string,
  actorId: string,
): Promise<TaskCard[]> {
  await requireMembership(projectId, actorId);

  const rows = await db
    .select({ task: tasks, commentCount: commentCountSql })
    .from(tasks)
    .innerJoin(boardColumns, eq(boardColumns.id, tasks.columnId))
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(boardColumns.position), asc(tasks.position), asc(tasks.id));

  const usersById = await loadUsers(
    rows.flatMap((row) => [
      row.task.createdBy,
      ...(row.task.assigneeId ? [row.task.assigneeId] : []),
    ]),
  );
  return rows.map((row) =>
    toTaskCard(buildRow(row.task, row.commentCount, usersById)),
  );
}

export async function getTaskDetail(
  taskId: string,
  actorId: string,
): Promise<TaskDetail> {
  const context = await requireTaskContext(taskId, actorId);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.taskId, taskId));

  const usersById = await loadUsers([
    context.task.createdBy,
    ...(context.task.assigneeId ? [context.task.assigneeId] : []),
  ]);
  return toTaskDetail(buildRow(context.task, countRow.count, usersById));
}

export async function assertColumnBelongsToProject(
  executor: DbExecutor,
  projectId: string,
  columnId: string,
) {
  const [column] = await executor
    .select()
    .from(boardColumns)
    .where(
      and(eq(boardColumns.id, columnId), eq(boardColumns.projectId, projectId)),
    )
    .limit(1);
  if (!column) {
    throw AppError.unprocessable(
      "INVALID_COLUMN",
      "Column does not belong to this project",
    );
  }
  return column;
}

export async function assertAssigneeIsMember(
  executor: DbExecutor,
  projectId: string,
  assigneeId: string,
): Promise<void> {
  const membership = await getMembership(projectId, assigneeId, executor);
  if (!membership) {
    throw AppError.unprocessable(
      "INVALID_ASSIGNEE",
      "Assignee must be a project member",
    );
  }
}

export async function createTask(
  projectId: string,
  actorId: string,
  input: CreateTaskInput,
): Promise<TaskDetail> {
  await requireMembership(projectId, actorId);

  return db.transaction(async (tx) => {
    const column = await assertColumnBelongsToProject(
      tx,
      projectId,
      input.columnId,
    );
    const assigneeId = input.assigneeId ?? null;
    if (assigneeId) {
      await assertAssigneeIsMember(tx, projectId, assigneeId);
    }

    // Lock the column before reading max(position) so concurrent appends
    // serialize instead of computing the same position twice.
    await tx
      .select({ id: boardColumns.id })
      .from(boardColumns)
      .where(eq(boardColumns.id, column.id))
      .limit(1)
      .for("update");

    const [maxRow] = await tx
      .select({ maxPosition: sql<number | null>`max(${tasks.position})` })
      .from(tasks)
      .where(eq(tasks.columnId, column.id));

    const [created] = await tx
      .insert(tasks)
      .values({
        projectId,
        columnId: column.id,
        title: input.title,
        description: input.description ?? "",
        priority: input.priority ?? "medium",
        dueDate: input.dueDate ?? null,
        assigneeId,
        createdBy: actorId,
        position: appendPosition(maxRow?.maxPosition ?? null),
      })
      .returning();

    const usersById = await loadUsers(
      [created.createdBy, ...(created.assigneeId ? [created.assigneeId] : [])],
      tx,
    );
    return toTaskDetail(buildRow(created, 0, usersById));
  });
}
