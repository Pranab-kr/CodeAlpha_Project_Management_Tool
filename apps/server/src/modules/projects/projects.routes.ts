import {
  addMemberSchema,
  createProjectSchema,
  projectIdParamsSchema,
  projectMemberParamsSchema,
  updateMemberRoleSchema,
  updateProjectSchema,
} from "@teamboard/shared";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import {
  addMemberController,
  createProjectController,
  deleteProjectController,
  getProjectController,
  listMembersController,
  listProjectsController,
  removeMemberController,
  updateMemberRoleController,
  updateProjectController,
} from "./projects.controller.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", listProjectsController);
projectsRouter.post(
  "/",
  validateBody(createProjectSchema),
  createProjectController,
);

projectsRouter.patch(
  "/:projectId",
  validateParams(projectIdParamsSchema),
  validateBody(updateProjectSchema),
  updateProjectController,
);
projectsRouter.delete(
  "/:projectId",
  validateParams(projectIdParamsSchema),
  deleteProjectController,
);
projectsRouter.get(
  "/:projectId",
  validateParams(projectIdParamsSchema),
  getProjectController,
);

projectsRouter.get(
  "/:projectId/members",
  validateParams(projectIdParamsSchema),
  listMembersController,
);
projectsRouter.post(
  "/:projectId/members",
  validateParams(projectIdParamsSchema),
  validateBody(addMemberSchema),
  addMemberController,
);
projectsRouter.patch(
  "/:projectId/members/:userId",
  validateParams(projectMemberParamsSchema),
  validateBody(updateMemberRoleSchema),
  updateMemberRoleController,
);
projectsRouter.delete(
  "/:projectId/members/:userId",
  validateParams(projectMemberParamsSchema),
  removeMemberController,
);
