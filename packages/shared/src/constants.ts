export const PROJECT_ROLES = ["owner", "admin", "member"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const NOTIFICATION_TYPES = ["task_assigned", "comment_added"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DEFAULT_COLUMNS = ["Backlog", "In Progress", "Done"] as const;

export const PROJECT_NAME_MAX = 120;
export const TASK_TITLE_MAX = 200;
export const COMMENT_BODY_MAX = 5000;
export const ACCESS_COOKIE = "ca_access";
export const REFRESH_COOKIE = "ca_refresh";
