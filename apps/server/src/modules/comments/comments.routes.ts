import {
  commentBodySchema,
  commentIdParamsSchema,
  taskIdParamsSchema,
} from "@teamboard/shared";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { createUserWriteLimiter } from "../../middleware/write-limit.js";
import {
  createCommentController,
  deleteCommentController,
  listCommentsController,
  updateCommentController,
} from "./comments.controller.js";

export const commentsRouter = Router();

commentsRouter.get(
  "/tasks/:taskId/comments",
  requireAuth,
  validateParams(taskIdParamsSchema),
  listCommentsController,
);
commentsRouter.post(
  "/tasks/:taskId/comments",
  requireAuth,
  validateParams(taskIdParamsSchema),
  validateBody(commentBodySchema),
  createUserWriteLimiter(),
  createCommentController,
);
commentsRouter.patch(
  "/comments/:commentId",
  requireAuth,
  validateParams(commentIdParamsSchema),
  validateBody(commentBodySchema),
  createUserWriteLimiter(),
  updateCommentController,
);
commentsRouter.delete(
  "/comments/:commentId",
  requireAuth,
  validateParams(commentIdParamsSchema),
  createUserWriteLimiter(),
  deleteCommentController,
);
