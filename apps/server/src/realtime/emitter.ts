import type { Notification, ServerToClientEvents } from "@teamboard/shared";
import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/client.js";
import {
  comments,
  notifications,
  projects,
  tasks,
  users,
} from "../db/schema/index.js";
import { toNotification } from "../modules/notifications/notifications.mapper.js";
import { getIo } from "./io.js";
import {
  getOnlineUserIds,
  removePresence,
  removeUserFromProject,
  resetPresenceForProject,
} from "./presence.js";
import { projectRoom, userRoom } from "./rooms.js";

export function emitToProject<E extends keyof ServerToClientEvents>(
  projectId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): void {
  const io = getIo();
  if (!io) return;
  const target = io.to(projectRoom(projectId)) as unknown as {
    emit: (event: string, ...payload: unknown[]) => void;
  };
  target.emit(event, ...args);
}

export function emitToUser<E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): void {
  const io = getIo();
  if (!io) return;
  const target = io.to(userRoom(userId)) as unknown as {
    emit: (event: string, ...payload: unknown[]) => void;
  };
  target.emit(event, ...args);
}

/**
 * Sends to the project room and every member's personal room before removing
 * the project sockets, so open boards react even if room state is already gone.
 */
export async function emitProjectDeleted(
  projectId: string,
  memberIds: string[],
): Promise<void> {
  const io = getIo();
  if (!io) return;

  const project = projectRoom(projectId);
  io.to(project)
    .to(memberIds.map(userRoom))
    .emit("project:deleted", { projectId });

  const sockets = await io.in(project).fetchSockets();
  for (const socket of sockets) {
    socket.data.joinedProjects.delete(projectId);
    await socket.leave(project);
  }
  resetPresenceForProject(projectId);
}

/** Emits to the project and removed user, then revokes their room access. */
export async function emitMemberRemoved(
  projectId: string,
  userId: string,
): Promise<void> {
  const io = getIo();
  if (!io) return;

  const project = projectRoom(projectId);
  io.to(project)
    .to(userRoom(userId))
    .emit("member:removed", { projectId, userId });

  const sockets = await io.in(userRoom(userId)).fetchSockets();
  for (const socket of sockets) {
    if (socket.data.joinedProjects.delete(projectId)) {
      await socket.leave(project);
      removePresence(projectId, userId, socket.id);
    }
  }
  removeUserFromProject(projectId, userId);

  io.to(project).emit("presence:update", {
    projectId,
    onlineUserIds: getOnlineUserIds(projectId),
  });
}

const actor = alias(users, "actor");

/** Loads joined DTOs for freshly created notifications and emits per recipient. */
export async function emitNotificationIds(ids: string[]): Promise<void> {
  if (ids.length === 0 || !getIo()) return;

  const rows = await db
    .select({
      notification: notifications,
      actor,
      projectName: projects.name,
      taskTitle: tasks.title,
      commentBody: comments.body,
    })
    .from(notifications)
    .innerJoin(actor, eq(actor.id, notifications.actorId))
    .innerJoin(projects, eq(projects.id, notifications.projectId))
    .leftJoin(tasks, eq(tasks.id, notifications.taskId))
    .leftJoin(comments, eq(comments.id, notifications.commentId))
    .where(inArray(notifications.id, ids));

  const deliveries: { userId: string; notification: Notification }[] = rows.map(
    (row) => ({
      userId: row.notification.userId,
      notification: toNotification(row),
    }),
  );

  for (const delivery of deliveries) {
    emitToUser(delivery.userId, "notification:new", {
      notification: delivery.notification,
    });
  }
}
