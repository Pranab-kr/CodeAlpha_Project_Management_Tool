export const queryKeys = {
  auth: ["auth"] as const,
  projects: ["projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  projectMembers: (projectId: string) =>
    ["projects", projectId, "members"] as const,
  userSearch: (search: string) => ["users", "search", search] as const,
  tasks: (projectId: string) => ["tasks", projectId] as const,
  task: (taskId: string) => ["task", taskId] as const,
  comments: (taskId: string) => ["comments", taskId] as const,
  notifications: ["notifications"] as const,
  notificationList: (cursor?: string) =>
    ["notifications", "list", cursor ?? "first"] as const,
  notificationUnreadCount: ["notifications", "unread-count"] as const,
};
