import {
  columnIdParamsSchema,
  createColumnSchema,
  projectIdParamsSchema,
  reorderColumnsSchema,
  updateColumnSchema,
} from "@teamboard/shared";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import {
  createColumnController,
  deleteColumnController,
  reorderColumnsController,
  updateColumnController,
} from "./columns.controller.js";

export const columnsRouter = Router();

// Auth is attached per route: these routers are mounted at /api/v1, so a
// router-level guard would turn every unknown /api/v1 path into a 401.
// The reorder route is registered before the generic column route so a future
// `PATCH /columns/:columnId` can never shadow it.
columnsRouter.patch(
  "/projects/:projectId/columns/reorder",
  requireAuth,
  validateParams(projectIdParamsSchema),
  validateBody(reorderColumnsSchema),
  reorderColumnsController,
);
columnsRouter.post(
  "/projects/:projectId/columns",
  requireAuth,
  validateParams(projectIdParamsSchema),
  validateBody(createColumnSchema),
  createColumnController,
);
columnsRouter.patch(
  "/columns/:columnId",
  requireAuth,
  validateParams(columnIdParamsSchema),
  validateBody(updateColumnSchema),
  updateColumnController,
);
columnsRouter.delete(
  "/columns/:columnId",
  requireAuth,
  validateParams(columnIdParamsSchema),
  deleteColumnController,
);
