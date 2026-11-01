import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tasks } from "./tasks.js";
import { users } from "./users.js";

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("comments_task_created_idx").on(table.taskId, table.createdAt),
  ],
);

export type SelectComment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;
