import { z } from "zod";
import { TASK_PRIORITIES } from "../constants.js";
import { userSummarySchema } from "./common.js";

export const taskPrioritySchema = z.enum(TASK_PRIORITIES);

export const taskCardSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  columnId: z.uuid(),
  title: z.string(),
  priority: taskPrioritySchema,
  dueDate: z.iso.date().nullable(),
  position: z.number(),
  assignee: userSummarySchema.nullable(),
  createdBy: userSummarySchema,
  commentCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TaskCard = z.infer<typeof taskCardSchema>;

export const taskDetailSchema = taskCardSchema.extend({
  description: z.string(),
});
export type TaskDetail = z.infer<typeof taskDetailSchema>;

export const createTaskSchema = z.object({
  columnId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).default(""),
  priority: taskPrioritySchema.default("medium"),
  dueDate: z.iso.date().nullable().optional(),
  assigneeId: z.uuid().nullable().optional(),
});
export type CreateTaskInput = z.input<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(10_000).optional(),
    priority: taskPrioritySchema.optional(),
    dueDate: z.iso.date().nullable().optional(),
    assigneeId: z.uuid().nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "At least one field is required",
    },
  );
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  columnId: z.uuid(),
  beforeTaskId: z.uuid().nullable().optional(),
  afterTaskId: z.uuid().nullable().optional(),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const taskIdParamsSchema = z.object({ taskId: z.uuid() });
