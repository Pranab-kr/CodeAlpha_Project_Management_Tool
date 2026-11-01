import { pgEnum } from "drizzle-orm/pg-core";
import {
  NOTIFICATION_TYPES,
  PROJECT_ROLES,
  TASK_PRIORITIES,
} from "@codealpha/shared";

export const projectRoleEnum = pgEnum("project_role", PROJECT_ROLES);
export const taskPriorityEnum = pgEnum("task_priority", TASK_PRIORITIES);
export const notificationTypeEnum = pgEnum(
  "notification_type",
  NOTIFICATION_TYPES,
);
