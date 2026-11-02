export function projectRoom(projectId: string): string {
  return `project:${projectId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
