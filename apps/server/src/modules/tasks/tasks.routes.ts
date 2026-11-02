import {
  createTaskSchema,
  projectIdParamsSchema,
  taskIdParamsSchema,
} from "@teamboard/shared";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { createUserWriteLimiter } from "../../middleware/write-limit.js";
import {
  createTaskController,
  getTaskController,
  listTasksController,
} from "./tasks.controller.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get(
  "/projects/:projectId/tasks",
  validateParams(projectIdParamsSchema),
  listTasksController,
);
tasksRouter.post(
  "/projects/:projectId/tasks",
  validateParams(projectIdParamsSchema),
  validateBody(createTaskSchema),
  createUserWriteLimiter(),
  createTaskController,
);
tasksRouter.get(
  "/tasks/:taskId",
  validateParams(taskIdParamsSchema),
  getTaskController,
);
