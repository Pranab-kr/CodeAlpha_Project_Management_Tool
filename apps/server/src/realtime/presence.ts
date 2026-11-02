const projects = new Map<string, Map<string, Set<string>>>();

export function addPresence(
  projectId: string,
  userId: string,
  socketId: string,
): void {
  let users = projects.get(projectId);
  if (!users) {
    users = new Map();
    projects.set(projectId, users);
  }
  let sockets = users.get(userId);
  if (!sockets) {
    sockets = new Set();
    users.set(userId, sockets);
  }
  sockets.add(socketId);
}

/** Removes one socket; returns the updated online user ids for the project. */
export function removePresence(
  projectId: string,
  userId: string,
  socketId: string,
): string[] {
  const users = projects.get(projectId);
  if (!users) return [];
  const sockets = users.get(userId);
  if (!sockets) return getOnlineUserIds(projectId);
  sockets.delete(socketId);
  if (sockets.size === 0) users.delete(userId);
  if (users.size === 0) projects.delete(projectId);
  return getOnlineUserIds(projectId);
}

/** Drops every socket for a user, e.g. after their membership is revoked. */
export function removeUserFromProject(projectId: string, userId: string): void {
  const users = projects.get(projectId);
  if (!users) return;
  users.delete(userId);
  if (users.size === 0) projects.delete(projectId);
}

export function getOnlineUserIds(projectId: string): string[] {
  return [...(projects.get(projectId)?.keys() ?? [])].sort();
}

export function resetPresenceForProject(projectId: string): void {
  projects.delete(projectId);
}

export function resetPresence(): void {
  projects.clear();
}
