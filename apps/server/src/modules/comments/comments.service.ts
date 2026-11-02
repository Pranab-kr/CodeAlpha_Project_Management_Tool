import type { Comment, ProjectRole } from "@teamboard/shared";
import { asc, eq } from "drizzle-orm";
import { db, type DbExecutor } from "../../db/client.js";
import {
  comments,
  tasks,
  users,
  type SelectComment,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { getMembership } from "../projects/projects.permissions.js";
import { requireTaskContext } from "../tasks/tasks.permissions.js";
import { canDeleteComment } from "./comments.permissions.js";
import { toComment, type CommentRow } from "./comments.mapper.js";

const COMMENT_READ_LIMIT = 200;

function commentNotFound(): AppError {
  return AppError.notFound("Comment not found", "COMMENT_NOT_FOUND");
}

async function loadJoinedComment(
  commentId: string,
  executor: DbExecutor = db,
): Promise<Comment> {
  const [row] = await executor
    .select({ comment: comments, author: users })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!row) throw commentNotFound();
  return toComment(row satisfies CommentRow);
}

interface CommentContext {
  comment: SelectComment;
  projectId: string;
  role: ProjectRole;
}

/**
 * A missing comment, a non-member, and a comment in a project the actor cannot
 * see all answer COMMENT_NOT_FOUND so the response never reveals task existence.
 */
async function requireCommentContext(
  commentId: string,
  actorId: string,
  executor: DbExecutor = db,
): Promise<CommentContext> {
  const [row] = await executor
    .select({ comment: comments, projectId: tasks.projectId })
    .from(comments)
    .innerJoin(tasks, eq(tasks.id, comments.taskId))
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!row) throw commentNotFound();

  const membership = await getMembership(row.projectId, actorId, executor);
  if (!membership) throw commentNotFound();
  return {
    comment: row.comment,
    projectId: row.projectId,
    role: membership.role,
  };
}

export async function listComments(
  taskId: string,
  actorId: string,
): Promise<Comment[]> {
  await requireTaskContext(taskId, actorId);

  const rows = await db
    .select({ comment: comments, author: users })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.taskId, taskId))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(COMMENT_READ_LIMIT);
  return rows.map((row) => toComment(row satisfies CommentRow));
}

export async function createComment(
  taskId: string,
  actorId: string,
  body: string,
): Promise<Comment> {
  await requireTaskContext(taskId, actorId);

  const [created] = await db
    .insert(comments)
    .values({ taskId, authorId: actorId, body })
    .returning();
  return loadJoinedComment(created.id);
}

export async function updateComment(
  commentId: string,
  actorId: string,
  body: string,
): Promise<Comment> {
  const context = await requireCommentContext(commentId, actorId);
  if (context.comment.authorId !== actorId) {
    throw AppError.forbidden(
      "Only the author can edit this comment",
      "FORBIDDEN",
    );
  }

  await db
    .update(comments)
    .set({ body, updatedAt: new Date() })
    .where(eq(comments.id, commentId));
  return loadJoinedComment(commentId);
}

export async function deleteComment(
  commentId: string,
  actorId: string,
): Promise<{ taskId: string; commentId: string; projectId: string }> {
  const context = await requireCommentContext(commentId, actorId);
  if (!canDeleteComment(context.role, context.comment.authorId, actorId)) {
    throw AppError.forbidden(
      "You do not have permission to delete this comment",
      "FORBIDDEN",
    );
  }

  await db.delete(comments).where(eq(comments.id, commentId));
  return {
    taskId: context.comment.taskId,
    commentId,
    projectId: context.projectId,
  };
}
