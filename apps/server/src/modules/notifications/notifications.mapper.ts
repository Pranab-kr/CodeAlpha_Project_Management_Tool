import type { Notification } from "@teamboard/shared";
import type { SelectNotification, SelectUser } from "../../db/schema/index.js";
import { toUserSummary } from "../users/users.mapper.js";

export interface NotificationRow {
  notification: SelectNotification;
  actor: SelectUser;
  projectName: string;
  taskTitle: string | null;
  commentBody: string | null;
}

const EXCERPT_LENGTH = 120;

export function toNotification(row: NotificationRow): Notification {
  const { notification } = row;
  return {
    id: notification.id,
    type: notification.type,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    actor: toUserSummary(row.actor),
    project: { id: notification.projectId, name: row.projectName },
    task:
      notification.taskId && row.taskTitle !== null
        ? { id: notification.taskId, title: row.taskTitle }
        : null,
    commentExcerpt:
      row.commentBody === null
        ? null
        : row.commentBody.slice(0, EXCERPT_LENGTH),
  };
}
