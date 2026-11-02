import { z } from "zod";
import { NOTIFICATION_TYPES } from "../constants.js";
import { userSummarySchema } from "./common.js";

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  actor: userSummarySchema,
  project: z.object({ id: z.uuid(), name: z.string() }),
  task: z.object({ id: z.uuid(), title: z.string() }).nullable(),
  commentExcerpt: z.string().nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
});
export type NotificationList = z.infer<typeof notificationListSchema>;

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().max(500).optional(),
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const notificationIdParamsSchema = z.object({ id: z.uuid() });
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
