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

columnsRouter.use(requireAuth);

// The reorder route is registered before the generic column route so a future
// `PATCH /columns/:columnId` can never shadow it.
columnsRouter.patch(
  "/projects/:projectId/columns/reorder",
  validateParams(projectIdParamsSchema),
  validateBody(reorderColumnsSchema),
  reorderColumnsController,
);
columnsRouter.post(
  "/projects/:projectId/columns",
  validateParams(projectIdParamsSchema),
  validateBody(createColumnSchema),
  createColumnController,
);
columnsRouter.patch(
  "/columns/:columnId",
  validateParams(columnIdParamsSchema),
  validateBody(updateColumnSchema),
  updateColumnController,
);
columnsRouter.delete(
  "/columns/:columnId",
  validateParams(columnIdParamsSchema),
  deleteColumnController,
);
