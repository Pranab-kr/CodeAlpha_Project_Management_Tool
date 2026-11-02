import {
  createTaskSchema,
  moveTaskSchema,
  projectIdParamsSchema,
  taskIdParamsSchema,
  updateTaskSchema,
} from "@teamboard/shared";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { createUserWriteLimiter } from "../../middleware/write-limit.js";
import {
  createTaskController,
  deleteTaskController,
  getTaskController,
  listTasksController,
  moveTaskController,
  updateTaskController,
} from "./tasks.controller.js";

export const tasksRouter = Router();

// Auth is attached per route: this router is mounted at /api/v1, so a
// router-level guard would turn every unknown /api/v1 path into a 401.
tasksRouter.get(
  "/projects/:projectId/tasks",
  requireAuth,
  validateParams(projectIdParamsSchema),
  listTasksController,
);
tasksRouter.post(
  "/projects/:projectId/tasks",
  requireAuth,
  validateParams(projectIdParamsSchema),
  validateBody(createTaskSchema),
  createUserWriteLimiter(),
  createTaskController,
);
tasksRouter.get(
  "/tasks/:taskId",
  requireAuth,
  validateParams(taskIdParamsSchema),
  getTaskController,
);

// The move route is registered before the generic task update (both PATCH).
tasksRouter.patch(
  "/tasks/:taskId/move",
  requireAuth,
  validateParams(taskIdParamsSchema),
  validateBody(moveTaskSchema),
  createUserWriteLimiter(),
  moveTaskController,
);
tasksRouter.patch(
  "/tasks/:taskId",
  requireAuth,
  validateParams(taskIdParamsSchema),
  validateBody(updateTaskSchema),
  createUserWriteLimiter(),
  updateTaskController,
);
tasksRouter.delete(
  "/tasks/:taskId",
  requireAuth,
  validateParams(taskIdParamsSchema),
  createUserWriteLimiter(),
  deleteTaskController,
);
