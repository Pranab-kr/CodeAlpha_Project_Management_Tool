import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
} from "@teamboard/shared";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateParams, validateQuery } from "../../middleware/validate.js";
import {
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
  unreadCountController,
} from "./notifications.controller.js";

export const notificationsRouter = Router();

// Auth is attached per route because this router is mounted at /api/v1.
notificationsRouter.get(
  "/notifications",
  requireAuth,
  validateQuery(notificationListQuerySchema),
  listNotificationsController,
);
notificationsRouter.get(
  "/notifications/unread-count",
  requireAuth,
  unreadCountController,
);
notificationsRouter.patch(
  "/notifications/:id/read",
  requireAuth,
  validateParams(notificationIdParamsSchema),
  markNotificationReadController,
);
notificationsRouter.post(
  "/notifications/read-all",
  requireAuth,
  markAllNotificationsReadController,
);
