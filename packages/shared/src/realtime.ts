import type {
  BoardColumn,
  Comment,
  Notification,
  ProjectMember,
  ProjectSummary,
  TaskCard,
} from "./api/index.js";

export interface JoinProjectPayload {
  projectId: string;
}

export type JoinProjectAck =
  | { ok: true; onlineUserIds: string[] }
  | { ok: false; code: "UNAUTHORIZED" | "NOT_FOUND" | "INVALID_PAYLOAD" };

export interface ClientToServerEvents {
  "project:join": (
    payload: JoinProjectPayload,
    ack: (response: JoinProjectAck) => void,
  ) => void;
  "project:leave": (
    payload: JoinProjectPayload,
    ack?: (response: { ok: true }) => void,
  ) => void;
}

export interface ServerToClientEvents {
  "task:created": (payload: { task: TaskCard }) => void;
  "task:updated": (payload: { task: TaskCard }) => void;
  "task:moved": (payload: { task: TaskCard; fromColumnId: string }) => void;
  "task:deleted": (payload: { taskId: string; columnId: string }) => void;

  "column:created": (payload: { column: BoardColumn }) => void;
  "column:updated": (payload: { column: BoardColumn }) => void;
  "column:deleted": (payload: { columnId: string }) => void;
  "columns:reordered": (payload: { columns: BoardColumn[] }) => void;

  "comment:created": (payload: { taskId: string; comment: Comment }) => void;
  "comment:updated": (payload: { taskId: string; comment: Comment }) => void;
  "comment:deleted": (payload: { taskId: string; commentId: string }) => void;

  "project:updated": (payload: { project: ProjectSummary }) => void;
  "project:deleted": (payload: { projectId: string }) => void;
  "member:added": (payload: { member: ProjectMember }) => void;
  "member:updated": (payload: { member: ProjectMember }) => void;
  "member:removed": (payload: { projectId: string; userId: string }) => void;
  "presence:update": (payload: {
    projectId: string;
    onlineUserIds: string[];
  }) => void;

  "notification:new": (payload: { notification: Notification }) => void;
  "notification:read": (payload: {
    notificationId: string;
    readAt: string;
  }) => void;
  "notifications:read-all": (payload: { readAt: string }) => void;
}
