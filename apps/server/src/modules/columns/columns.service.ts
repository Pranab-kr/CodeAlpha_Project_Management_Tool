import type {
  BoardColumn,
  CreateColumnInput,
  ProjectRole,
  ReorderColumnsInput,
  UpdateColumnInput,
} from "@teamboard/shared";
import { asc, eq, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../../db/client.js";
import {
  boardColumns,
  projects,
  tasks,
  type SelectBoardColumn,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { appendPosition } from "../../lib/ordering.js";
import { toBoardColumn } from "../projects/projects.mapper.js";
import {
  getMembership,
  isManager,
  requireRole,
} from "../projects/projects.permissions.js";

export interface ColumnContext {
  column: SelectBoardColumn;
  projectId: string;
  role: ProjectRole;
}

function forbidden(): AppError {
  return AppError.forbidden(
    "You do not have permission to manage this board",
    "FORBIDDEN",
  );
}

/**
 * Resolving a column must not reveal whether its project exists to an outsider,
 * so both a missing column and a non-member answer with COLUMN_NOT_FOUND.
 */
export async function getColumnContext(
  columnId: string,
  userId: string,
  executor: DbExecutor = db,
): Promise<ColumnContext> {
  const [column] = await executor
    .select()
    .from(boardColumns)
    .where(eq(boardColumns.id, columnId))
    .limit(1);
  if (!column) {
    throw AppError.notFound("Column not found", "COLUMN_NOT_FOUND");
  }

  const membership = await getMembership(column.projectId, userId, executor);
  if (!membership) {
    throw AppError.notFound("Column not found", "COLUMN_NOT_FOUND");
  }
  return { column, projectId: column.projectId, role: membership.role };
}

/** Serializes board changes for one project (creates and reorders). */
async function lockProject(executor: DbExecutor, projectId: string) {
  const [project] = await executor
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
    .for("update");
  if (!project) {
    throw AppError.notFound("Project not found", "PROJECT_NOT_FOUND");
  }
}

export async function createColumn(
  projectId: string,
  actorId: string,
  input: CreateColumnInput,
): Promise<BoardColumn> {
  await requireRole(projectId, actorId, ["owner", "admin"]);

  return db.transaction(async (tx) => {
    await lockProject(tx, projectId);
    const [row] = await tx
      .select({
        maxPosition: sql<number | null>`max(${boardColumns.position})`,
      })
      .from(boardColumns)
      .where(eq(boardColumns.projectId, projectId));

    const [created] = await tx
      .insert(boardColumns)
      .values({
        projectId,
        name: input.name,
        position: appendPosition(row?.maxPosition ?? null),
      })
      .returning();
    return toBoardColumn(created);
  });
}

export async function updateColumn(
  columnId: string,
  actorId: string,
  input: UpdateColumnInput,
): Promise<BoardColumn> {
  const context = await getColumnContext(columnId, actorId);
  if (!isManager(context.role)) throw forbidden();

  const [updated] = await db
    .update(boardColumns)
    .set({ name: input.name })
    .where(eq(boardColumns.id, columnId))
    .returning();
  return toBoardColumn(updated);
}

export async function reorderColumns(
  projectId: string,
  actorId: string,
  input: ReorderColumnsInput,
): Promise<BoardColumn[]> {
  await requireRole(projectId, actorId, ["owner", "admin"]);

  return db.transaction(async (tx) => {
    await lockProject(tx, projectId);
    const columns = await tx
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.projectId, projectId))
      .orderBy(asc(boardColumns.id))
      .for("update");

    const byId = new Map(columns.map((column) => [column.id, column]));
    const requested = input.columnIds;
    const unique = new Set(requested);
    const invalid =
      requested.length !== columns.length ||
      unique.size !== requested.length ||
      requested.some((id) => !byId.has(id));
    if (invalid) {
      throw AppError.unprocessable(
        "INVALID_COLUMN_ORDER",
        "columnIds must be an exact permutation of the project's columns",
      );
    }

    const reordered: BoardColumn[] = [];
    for (const [index, id] of requested.entries()) {
      const position = (index + 1) * 1024;
      const column = byId.get(id);
      if (!column) {
        throw AppError.unprocessable(
          "INVALID_COLUMN_ORDER",
          "columnIds must be an exact permutation of the project's columns",
        );
      }
      await tx
        .update(boardColumns)
        .set({ position })
        .where(eq(boardColumns.id, id));
      reordered.push(toBoardColumn({ ...column, position }));
    }
    return reordered;
  });
}

export async function deleteColumn(
  columnId: string,
  actorId: string,
): Promise<{ columnId: string; projectId: string }> {
  const context = await getColumnContext(columnId, actorId);
  if (!isManager(context.role)) throw forbidden();

  return db.transaction(async (tx) => {
    // Lock before counting so a concurrent task create cannot slip in between.
    const [column] = await tx
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.id, columnId))
      .limit(1)
      .for("update");
    if (!column) {
      throw AppError.notFound("Column not found", "COLUMN_NOT_FOUND");
    }

    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.columnId, columnId));
    if (row.count > 0) {
      throw AppError.conflict(
        "Move or delete this column's tasks first",
        "COLUMN_NOT_EMPTY",
      );
    }

    await tx.delete(boardColumns).where(eq(boardColumns.id, columnId));
    return { columnId, projectId: context.projectId };
  });
}
