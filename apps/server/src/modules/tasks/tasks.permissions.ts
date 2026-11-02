import type { ProjectRole } from "@teamboard/shared";
import { eq } from "drizzle-orm";
import { db, type DbExecutor } from "../../db/client.js";
import { tasks, type SelectTask } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { getMembership } from "../projects/projects.permissions.js";

export interface TaskContext {
  task: SelectTask;
  projectId: string;
  role: ProjectRole;
}

/** Creator, admin, or owner. Plain members cannot delete another's task. */
export function canDeleteTask(
  role: ProjectRole,
  createdBy: string,
  actorId: string,
): boolean {
  return role === "owner" || role === "admin" || createdBy === actorId;
}

/**
 * A missing task and a non-member both answer TASK_NOT_FOUND so task routes do
 * not leak project or task existence.
 */
export async function requireTaskContext(
  taskId: string,
  actorId: string,
  executor: DbExecutor = db,
): Promise<TaskContext> {
  const [task] = await executor
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!task) {
    throw AppError.notFound("Task not found", "TASK_NOT_FOUND");
  }

  const membership = await getMembership(task.projectId, actorId, executor);
  if (!membership) {
    throw AppError.notFound("Task not found", "TASK_NOT_FOUND");
  }
  return { task, projectId: task.projectId, role: membership.role };
}
