import { createProjectSchema, projectIdParamsSchema } from "@teamboard/shared";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import {
  createProjectController,
  getProjectController,
  listProjectsController,
} from "./projects.controller.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", listProjectsController);
projectsRouter.post(
  "/",
  validateBody(createProjectSchema),
  createProjectController,
);
projectsRouter.get(
  "/:projectId",
  validateParams(projectIdParamsSchema),
  getProjectController,
);
