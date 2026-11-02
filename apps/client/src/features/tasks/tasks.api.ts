import type {
  CreateColumnInput,
  CreateTaskInput,
  MoveTaskInput,
  ReorderColumnsInput,
  TaskCard,
  TaskDetail,
  UpdateColumnInput,
  UpdateTaskInput,
} from "@teamboard/shared";
import { apiFetch } from "../../lib/api";

export function listTasks(projectId: string): Promise<{ tasks: TaskCard[] }> {
  return apiFetch<{ tasks: TaskCard[] }>(`/projects/${projectId}/tasks`);
}

export function getTask(taskId: string): Promise<{ task: TaskDetail }> {
  return apiFetch<{ task: TaskDetail }>(`/tasks/${taskId}`);
}

export function createTask(
  projectId: string,
  input: CreateTaskInput,
): Promise<{ task: TaskDetail }> {
  return apiFetch<{ task: TaskDetail }>(`/projects/${projectId}/tasks`, {
    method: "POST",
    body: input,
  });
}

export function updateTask(
  taskId: string,
  input: UpdateTaskInput,
): Promise<{ task: TaskDetail }> {
  return apiFetch<{ task: TaskDetail }>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: input,
  });
}

export function moveTask(
  taskId: string,
  input: MoveTaskInput,
): Promise<{ task: TaskDetail }> {
  return apiFetch<{ task: TaskDetail }>(`/tasks/${taskId}/move`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteTask(taskId: string): Promise<void> {
  return apiFetch<void>(`/tasks/${taskId}`, { method: "DELETE" });
}

export function createColumn(
  projectId: string,
  input: CreateColumnInput,
): Promise<{ column: { id: string; name: string } }> {
  return apiFetch<{ column: { id: string; name: string } }>(
    `/projects/${projectId}/columns`,
    { method: "POST", body: input },
  );
}

export function updateColumn(
  columnId: string,
  input: UpdateColumnInput,
): Promise<{ column: { id: string; name: string } }> {
  return apiFetch<{ column: { id: string; name: string } }>(
    `/columns/${columnId}`,
    { method: "PATCH", body: input },
  );
}

export function reorderColumns(
  projectId: string,
  input: ReorderColumnsInput,
): Promise<{ columns: { id: string; name: string }[] }> {
  return apiFetch<{ columns: { id: string; name: string }[] }>(
    `/projects/${projectId}/columns/reorder`,
    { method: "PATCH", body: input },
  );
}

export function deleteColumn(columnId: string): Promise<void> {
  return apiFetch<void>(`/columns/${columnId}`, { method: "DELETE" });
}
