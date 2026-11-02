import type { TaskCard, TaskDetail } from "@teamboard/shared";
import type { SelectTask, SelectUser } from "../../db/schema/index.js";
import { toUserSummary } from "../users/users.mapper.js";

export interface TaskRow {
  task: SelectTask;
  commentCount: number;
  assignee: SelectUser | null;
  creator: SelectUser;
}

export function toTaskCard(row: TaskRow): TaskCard {
  return {
    id: row.task.id,
    projectId: row.task.projectId,
    columnId: row.task.columnId,
    title: row.task.title,
    priority: row.task.priority,
    dueDate: row.task.dueDate,
    position: row.task.position,
    assignee: row.assignee ? toUserSummary(row.assignee) : null,
    createdBy: toUserSummary(row.creator),
    commentCount: row.commentCount,
    createdAt: row.task.createdAt.toISOString(),
    updatedAt: row.task.updatedAt.toISOString(),
  };
}

export function toTaskDetail(row: TaskRow): TaskDetail {
  return { ...toTaskCard(row), description: row.task.description };
}

/** Realtime task events carry cards, never the full description. */
export function toTaskCardFromDetail(detail: TaskDetail): TaskCard {
  const { description: _description, ...card } = detail;
  return card;
}
