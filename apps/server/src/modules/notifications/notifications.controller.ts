import type { NotificationListQuery } from "@teamboard/shared";
import type { RequestHandler } from "express";
import { requireActorId } from "../../middleware/auth.js";
import { emitToUser } from "../../realtime/emitter.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
} from "./notifications.queries.js";

export const listNotificationsController: RequestHandler = async (req, res) => {
  const query = res.locals.query as NotificationListQuery;
  const list = await listNotifications(requireActorId(req), query);
  res.status(200).json({ data: list });
};

export const unreadCountController: RequestHandler = async (req, res) => {
  const count = await unreadCount(requireActorId(req));
  res.status(200).json({ data: { count } });
};

export const markNotificationReadController: RequestHandler = async (
  req,
  res,
) => {
  const { id } = res.locals.params as { id: string };
  const userId = requireActorId(req);
  const notification = await markNotificationRead(userId, id);
  if (notification.readAt) {
    emitToUser(userId, "notification:read", {
      notificationId: notification.id,
      readAt: notification.readAt,
    });
  }
  res.status(200).json({ data: { notification } });
};

export const markAllNotificationsReadController: RequestHandler = async (
  req,
  res,
) => {
  const userId = requireActorId(req);
  const { updated, readAt } = await markAllNotificationsRead(userId);
  emitToUser(userId, "notifications:read-all", {
    readAt: readAt.toISOString(),
  });
  res.status(200).json({ data: { updated } });
};
