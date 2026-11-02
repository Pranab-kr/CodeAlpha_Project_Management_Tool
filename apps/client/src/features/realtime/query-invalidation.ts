import type { ServerToClientEvents } from "@teamboard/shared";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";

type EventPayload<K extends keyof ServerToClientEvents> = Parameters<
  ServerToClientEvents[K]
>[0];

/**
 * Cache side of realtime sync. Navigation, toasts, and notification counters
 * live in useRealtimeSync; this helper stays pure so it can be unit tested.
 */
export function invalidateForEvent<K extends keyof ServerToClientEvents>(
  queryClient: QueryClient,
  event: K,
  payload: EventPayload<K>,
): void {
  switch (event) {
    case "task:created":
    case "task:updated":
    case "task:moved": {
      const task = (payload as EventPayload<"task:created">).task;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(task.projectId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(task.projectId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      break;
    }
    case "task:deleted": {
      const { taskId } = payload as EventPayload<"task:deleted">;
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      break;
    }
    case "column:created":
    case "column:updated":
    case "column:deleted":
    case "columns:reordered":
    case "member:added":
    case "member:updated": {
      // Column payloads do not always carry a project id.
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "projects",
      });
      break;
    }
    case "comment:created":
    case "comment:updated":
    case "comment:deleted": {
      const { taskId } = payload as
        EventPayload<"comment:created"> | EventPayload<"comment:deleted">;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.comments(taskId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      break;
    }
    case "project:updated": {
      const { project } = payload as EventPayload<"project:updated">;
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(project.id),
      });
      break;
    }
    case "project:deleted": {
      const { projectId } = payload as EventPayload<"project:deleted">;
      queryClient.removeQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      break;
    }
    case "member:removed": {
      const { projectId } = payload as EventPayload<"member:removed">;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(projectId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      break;
    }
    case "notification:new":
    case "notification:read":
    case "notifications:read-all": {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      break;
    }
    case "presence:update":
      break;
    default:
      break;
  }
}
