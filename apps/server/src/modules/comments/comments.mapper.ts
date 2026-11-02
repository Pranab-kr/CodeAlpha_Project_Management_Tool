import type { Comment } from "@teamboard/shared";
import type { SelectComment, SelectUser } from "../../db/schema/index.js";
import { toUserSummary } from "../users/users.mapper.js";

export interface CommentRow {
  comment: SelectComment;
  author: SelectUser;
}

export function toComment(row: CommentRow): Comment {
  return {
    id: row.comment.id,
    taskId: row.comment.taskId,
    body: row.comment.body,
    author: toUserSummary(row.author),
    createdAt: row.comment.createdAt.toISOString(),
    updatedAt: row.comment.updatedAt.toISOString(),
  };
}
