import type { Comment } from "@teamboard/shared";
import { apiFetch } from "../../lib/api";

export function listComments(taskId: string): Promise<{ comments: Comment[] }> {
  return apiFetch<{ comments: Comment[] }>(`/tasks/${taskId}/comments`);
}

export function createComment(
  taskId: string,
  body: string,
): Promise<{ comment: Comment }> {
  return apiFetch<{ comment: Comment }>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: { body },
  });
}

export function updateComment(
  commentId: string,
  body: string,
): Promise<{ comment: Comment }> {
  return apiFetch<{ comment: Comment }>(`/comments/${commentId}`, {
    method: "PATCH",
    body: { body },
  });
}

export function deleteComment(commentId: string): Promise<void> {
  return apiFetch<void>(`/comments/${commentId}`, { method: "DELETE" });
}
