import { and, eq, inArray } from "drizzle-orm";
import type { DbExecutor } from "../../db/client.js";
import {
  notifications,
  projectMembers,
  tasks,
  type InsertNotification,
} from "../../db/schema/index.js";
import {
  assignmentRecipient,
  commentRecipients,
} from "./notification-recipients.js";

/** Inserts rows and returns their ids so the caller can emit after commit. */
export async function insertNotificationRows(
  executor: DbExecutor,
  rows: InsertNotification[],
): Promise<string[]> {
  if (rows.length === 0) return [];
  // Application timestamps keep millisecond precision, which the cursor
  // round-trips exactly; now() would add microseconds the driver truncates.
  const createdAt = new Date();
  const inserted = await executor
    .insert(notifications)
    .values(rows.map((row) => ({ ...row, createdAt })))
    .returning({ id: notifications.id });
  return inserted.map((row) => row.id);
}

export interface TaskAssignedNotificationInput {
  projectId: string;
  taskId: string;
  actorId: string;
  previousAssigneeId: string | null;
  nextAssigneeId: string | null;
}

export async function notifyTaskAssigned(
  executor: DbExecutor,
  input: TaskAssignedNotificationInput,
): Promise<string[]> {
  const userId = assignmentRecipient(input);
  if (!userId) return [];

  const [membership] = await executor
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, input.projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);
  if (!membership) return [];

  return insertNotificationRows(executor, [
    {
      userId,
      actorId: input.actorId,
      type: "task_assigned",
      projectId: input.projectId,
      taskId: input.taskId,
    },
  ]);
}

export interface CommentAddedNotificationInput {
  projectId: string;
  taskId: string;
  commentId: string;
  actorId: string;
}

export async function notifyCommentAdded(
  executor: DbExecutor,
  input: CommentAddedNotificationInput,
): Promise<string[]> {
  const [task] = await executor
    .select({ assigneeId: tasks.assigneeId, createdBy: tasks.createdBy })
    .from(tasks)
    .where(eq(tasks.id, input.taskId))
    .limit(1);
  if (!task) return [];

  const candidates = commentRecipients({
    assigneeId: task.assigneeId,
    createdById: task.createdBy,
    actorId: input.actorId,
  });
  if (candidates.length === 0) return [];

  const members = await executor
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, input.projectId),
        inArray(projectMembers.userId, candidates),
      ),
    );
  const allowed = new Set(members.map((member) => member.userId));

  return insertNotificationRows(
    executor,
    candidates
      .filter((userId) => allowed.has(userId))
      .map((userId) => ({
        userId,
        actorId: input.actorId,
        type: "comment_added" as const,
        projectId: input.projectId,
        taskId: input.taskId,
        commentId: input.commentId,
      })),
  );
}
