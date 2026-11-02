import type {
  CreateColumnInput,
  ReorderColumnsInput,
  UpdateColumnInput,
} from "@teamboard/shared";
import type { RequestHandler } from "express";
import { requireActorId } from "../../middleware/auth.js";
import {
  createColumn,
  deleteColumn,
  reorderColumns,
  updateColumn,
} from "./columns.service.js";

export const createColumnController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  const input = res.locals.body as CreateColumnInput;
  const column = await createColumn(projectId, requireActorId(req), input);
  res.status(201).json({ data: { column } });
};

export const updateColumnController: RequestHandler = async (req, res) => {
  const { columnId } = res.locals.params as { columnId: string };
  const input = res.locals.body as UpdateColumnInput;
  const column = await updateColumn(columnId, requireActorId(req), input);
  res.status(200).json({ data: { column } });
};

export const reorderColumnsController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  const input = res.locals.body as ReorderColumnsInput;
  const columns = await reorderColumns(projectId, requireActorId(req), input);
  res.status(200).json({ data: { columns } });
};

export const deleteColumnController: RequestHandler = async (req, res) => {
  const { columnId } = res.locals.params as { columnId: string };
  await deleteColumn(columnId, requireActorId(req));
  res.status(204).send();
};
