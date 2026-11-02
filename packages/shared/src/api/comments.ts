import { z } from "zod";
import { COMMENT_BODY_MAX } from "../constants.js";
import { userSummarySchema } from "./common.js";

export const commentSchema = z.object({
  id: z.uuid(),
  taskId: z.uuid(),
  body: z.string(),
  author: userSummarySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Comment = z.infer<typeof commentSchema>;

export const commentBodySchema = z.object({
  body: z.string().trim().min(1).max(COMMENT_BODY_MAX),
});
export type CommentBodyInput = z.infer<typeof commentBodySchema>;

export const commentIdParamsSchema = z.object({ commentId: z.uuid() });
