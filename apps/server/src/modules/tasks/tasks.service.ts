import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskCard,
  TaskDetail,
  TaskPriority,
  UpdateTaskInput,
} from "@teamboard/shared";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../../db/client.js";
import {
  boardColumns,
  tasks,
  users,
  type SelectTask,
  type SelectUser,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import {
  appendPosition,
  computePosition,
  needsRenumber,
  renumberedPositions,
} from "../../lib/ordering.js";
import { emitNotificationIds, emitToProject } from "../../realtime/emitter.js";
import { notifyTaskAssigned } from "../notifications/notifications.service.js";
import {
  getMembership,
  requireMembership,
} from "../projects/projects.permissions.js";
import {
  toTaskCard,
  toTaskCardFromDetail,
  toTaskDetail,
  type TaskRow,
} from "./tasks.mapper.js";
import { canDeleteTask, requireTaskContext } from "./tasks.permissions.js";

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

/** Loads the full detail (with a live comment count) using any executor. */
async function loadTaskDetail(
  taskId: string,
  executor: DbExecutor = db,
): Promise<TaskDetail> {
  const [row] = await executor
    .select({ task: tasks, commentCount: commentCountSql })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!row) {
    throw AppError.notFound("Task not found", "TASK_NOT_FOUND");
  }

  const usersById = await loadUsers(
    [row.task.createdBy, ...(row.task.assigneeId ? [row.task.assigneeId] : [])],
    executor,
  );
  return toTaskDetail(buildRow(row.task, row.commentCount, usersById));
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
  await requireTaskContext(taskId, actorId);
  return loadTaskDetail(taskId);
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

export interface TaskWriteResult {
  task: TaskDetail;
  /** Notification ids created in the same transaction, for post-commit emits. */
  notificationIds: string[];
}

export async function createTask(
  projectId: string,
  actorId: string,
  input: CreateTaskInput,
): Promise<TaskWriteResult> {
  await requireMembership(projectId, actorId);

  const result = await db.transaction(async (tx) => {
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

    const notificationIds = assigneeId
      ? await notifyTaskAssigned(tx, {
          projectId,
          taskId: created.id,
          actorId,
          previousAssigneeId: null,
          nextAssigneeId: assigneeId,
        })
      : [];

    return { task: await loadTaskDetail(created.id, tx), notificationIds };
  });

  emitToProject(projectId, "task:created", {
    task: toTaskCardFromDetail(result.task),
  });
  await emitNotificationIds(result.notificationIds);
  return result;
}

export async function updateTask(
  taskId: string,
  actorId: string,
  input: UpdateTaskInput,
): Promise<TaskWriteResult> {
  const context = await requireTaskContext(taskId, actorId);

  const result = await db.transaction(async (tx) => {
    // Lock the row so the previous assignee cannot change under the update.
    const [current] = await tx
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)
      .for("update");
    if (!current) {
      throw AppError.notFound("Task not found", "TASK_NOT_FOUND");
    }

    const patch: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      dueDate?: string | null;
      assigneeId?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
    if (input.assigneeId !== undefined) {
      if (input.assigneeId !== null) {
        await assertAssigneeIsMember(tx, context.projectId, input.assigneeId);
      }
      patch.assigneeId = input.assigneeId;
    }

    await tx.update(tasks).set(patch).where(eq(tasks.id, taskId));

    const notificationIds =
      input.assigneeId !== undefined
        ? await notifyTaskAssigned(tx, {
            projectId: context.projectId,
            taskId,
            actorId,
            previousAssigneeId: current.assigneeId,
            nextAssigneeId: input.assigneeId,
          })
        : [];

    return { task: await loadTaskDetail(taskId, tx), notificationIds };
  });

  emitToProject(context.projectId, "task:updated", {
    task: toTaskCardFromDetail(result.task),
  });
  await emitNotificationIds(result.notificationIds);
  return result;
}

function invalidNeighbours(): AppError {
  return AppError.unprocessable(
    "INVALID_NEIGHBOURS",
    "Neighbours must be distinct tasks in the target column, in order",
  );
}

async function lockColumn(
  executor: DbExecutor,
  columnId: string,
): Promise<void> {
  await executor
    .select({ id: boardColumns.id })
    .from(boardColumns)
    .where(eq(boardColumns.id, columnId))
    .limit(1)
    .for("update");
}

async function loadTask(
  executor: DbExecutor,
  taskId: string,
): Promise<SelectTask | null> {
  const [task] = await executor
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  return task ?? null;
}

/** Renumber a column to 1024, 2048, … while excluding the task being moved. */
async function renumberColumn(
  executor: DbExecutor,
  columnId: string,
  excludeTaskId: string,
): Promise<void> {
  const rows = await executor
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.columnId, columnId), ne(tasks.id, excludeTaskId)))
    .orderBy(asc(tasks.position), asc(tasks.id));

  const positions = renumberedPositions(rows.length);
  for (const [index, row] of rows.entries()) {
    await executor
      .update(tasks)
      .set({ position: positions[index] })
      .where(eq(tasks.id, row.id));
  }
}

export async function moveTask(
  taskId: string,
  actorId: string,
  input: MoveTaskInput,
): Promise<{ task: TaskDetail; fromColumnId: string }> {
  const context = await requireTaskContext(taskId, actorId);
  const fromColumnId = context.task.columnId;

  const result = await db.transaction(async (tx) => {
    // Lock the task so two moves of the same card serialize.
    const task = await loadTask(tx, taskId);
    if (!task) {
      throw AppError.notFound("Task not found", "TASK_NOT_FOUND");
    }

    const target = await assertColumnBelongsToProject(
      tx,
      task.projectId,
      input.columnId,
    );

    // Lock both columns in sorted id order (deduplicated) to avoid deadlocks
    // with concurrent appends and moves.
    const columnIds = [...new Set([task.columnId, target.id])].sort();
    for (const columnId of columnIds) {
      await lockColumn(tx, columnId);
    }

    const beforeId = input.beforeTaskId ?? null;
    const afterId = input.afterTaskId ?? null;
    if (beforeId && afterId && beforeId === afterId) {
      throw invalidNeighbours();
    }

    let beforeTask: SelectTask | null = null;
    let afterTask: SelectTask | null = null;

    if (beforeId) {
      const candidate = await loadTask(tx, beforeId);
      if (
        !candidate ||
        candidate.id === taskId ||
        candidate.columnId !== target.id
      ) {
        throw invalidNeighbours();
      }
      beforeTask = candidate;
    }

    if (afterId) {
      const candidate = await loadTask(tx, afterId);
      if (
        !candidate ||
        candidate.id === taskId ||
        candidate.columnId !== target.id
      ) {
        throw invalidNeighbours();
      }
      afterTask = candidate;
    }

    if (beforeTask && afterTask && beforeTask.position >= afterTask.position) {
      throw invalidNeighbours();
    }

    let position: number;
    if (!beforeTask && !afterTask) {
      // Both neighbours omitted means append to the end of the target column.
      const [maxRow] = await tx
        .select({ maxPosition: sql<number | null>`max(${tasks.position})` })
        .from(tasks)
        .where(and(eq(tasks.columnId, target.id), ne(tasks.id, taskId)));
      position = appendPosition(maxRow?.maxPosition ?? null);
    } else {
      if (
        needsRenumber(beforeTask?.position ?? null, afterTask?.position ?? null)
      ) {
        await renumberColumn(tx, target.id, taskId);
        if (beforeId) {
          beforeTask = await loadTask(tx, beforeId);
          if (!beforeTask) throw invalidNeighbours();
        }
        if (afterId) {
          afterTask = await loadTask(tx, afterId);
          if (!afterTask) throw invalidNeighbours();
        }
      }
      position = computePosition(
        beforeTask?.position ?? null,
        afterTask?.position ?? null,
      );
    }

    await tx
      .update(tasks)
      .set({ columnId: target.id, position, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    return { task: await loadTaskDetail(taskId, tx), fromColumnId };
  });

  emitToProject(context.projectId, "task:moved", {
    task: toTaskCardFromDetail(result.task),
    fromColumnId: result.fromColumnId,
  });
  return result;
}

export async function deleteTask(
  taskId: string,
  actorId: string,
): Promise<{ taskId: string; columnId: string; projectId: string }> {
  const context = await requireTaskContext(taskId, actorId);
  if (!canDeleteTask(context.role, context.task.createdBy, actorId)) {
    throw AppError.forbidden(
      "Only the task creator, an admin, or the owner can delete this task",
      "FORBIDDEN",
    );
  }

  await db.delete(tasks).where(eq(tasks.id, taskId));
  const result = {
    taskId,
    columnId: context.task.columnId,
    projectId: context.projectId,
  };
  emitToProject(result.projectId, "task:deleted", {
    taskId: result.taskId,
    columnId: result.columnId,
  });
  return result;
}
