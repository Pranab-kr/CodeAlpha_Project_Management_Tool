import type {
  Notification,
  NotificationList,
  NotificationListQuery,
} from "@teamboard/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type DbExecutor } from "../../db/client.js";
import {
  comments,
  notifications,
  projects,
  tasks,
  users,
} from "../../db/schema/index.js";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from "../../lib/cursor.js";
import { AppError } from "../../lib/errors.js";
import { toNotification } from "./notifications.mapper.js";

const actor = alias(users, "actor");

// The cursor must keep Postgres microseconds; the pg driver's Date has only
// milliseconds, which could skip rows that share a millisecond.
const cursorTimestamp = sql<string>`to_char(${notifications.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

const joinedSelection = {
  notification: notifications,
  actor,
  projectName: projects.name,
  taskTitle: tasks.title,
  commentBody: comments.body,
  cursorTimestamp,
};

function joinedFrom(executor: DbExecutor) {
  return executor
    .select(joinedSelection)
    .from(notifications)
    .innerJoin(actor, eq(actor.id, notifications.actorId))
    .innerJoin(projects, eq(projects.id, notifications.projectId))
    .leftJoin(tasks, eq(tasks.id, notifications.taskId))
    .leftJoin(comments, eq(comments.id, notifications.commentId));
}

function notificationNotFound(): AppError {
  return AppError.notFound("Notification not found", "NOTIFICATION_NOT_FOUND");
}

async function loadNotification(
  notificationId: string,
  userId: string,
): Promise<Notification> {
  const [row] = await joinedFrom(db)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    )
    .limit(1);
  if (!row) throw notificationNotFound();
  return toNotification(row);
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.count ?? 0;
}

export async function listNotifications(
  userId: string,
  query: NotificationListQuery,
): Promise<NotificationList> {
  const cursor = query.cursor
    ? decodeNotificationCursor(query.cursor)
    : undefined;

  const rows = await joinedFrom(db)
    .where(
      and(
        eq(notifications.userId, userId),
        cursor
          ? sql`(${notifications.createdAt}, ${notifications.id}) < (${cursor.createdAtRaw}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const last = page[page.length - 1];

  return {
    items: page.map(toNotification),
    unreadCount: await unreadCount(userId),
    nextCursor:
      hasMore && last
        ? encodeNotificationCursor({
            createdAt: last.cursorTimestamp,
            id: last.notification.id,
          })
        : null,
  };
}

/** Idempotent: a second call keeps the original read timestamp. */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<Notification> {
  const [existing] = await db
    .select({ readAt: notifications.readAt })
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    )
    .limit(1);
  if (!existing) throw notificationNotFound();

  if (!existing.readAt) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        ),
      );
  }
  return loadNotification(notificationId, userId);
}

export async function markAllNotificationsRead(
  userId: string,
): Promise<{ updated: number; readAt: Date }> {
  const readAt = new Date();
  const rows = await db
    .update(notifications)
    .set({ readAt })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return { updated: rows.length, readAt };
}
