import { z } from "zod";

export const boardColumnSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  position: z.number(),
  createdAt: z.iso.datetime(),
});
export type BoardColumn = z.infer<typeof boardColumnSchema>;

export const createColumnSchema = z.object({
  name: z.string().trim().min(1).max(60),
});
export const updateColumnSchema = z.object({
  name: z.string().trim().min(1).max(60),
});
export const reorderColumnsSchema = z.object({
  columnIds: z.array(z.uuid()).min(1).max(50),
});
export const columnIdParamsSchema = z.object({ columnId: z.uuid() });

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;
