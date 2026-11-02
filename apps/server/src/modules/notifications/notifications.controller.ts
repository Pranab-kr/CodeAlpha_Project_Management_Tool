import type { NotificationListQuery } from "@teamboard/shared";
import type { RequestHandler } from "express";
import { requireActorId } from "../../middleware/auth.js";
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
  const notification = await markNotificationRead(requireActorId(req), id);
  res.status(200).json({ data: { notification } });
};

export const markAllNotificationsReadController: RequestHandler = async (
  req,
  res,
) => {
  const { updated } = await markAllNotificationsRead(requireActorId(req));
  res.status(200).json({ data: { updated } });
};
