import type { CreateTaskInput } from "@teamboard/shared";
import type { RequestHandler } from "express";
import { requireActorId } from "../../middleware/auth.js";
import { createTask, getTaskDetail, listTasks } from "./tasks.service.js";

export const listTasksController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  const tasks = await listTasks(projectId, requireActorId(req));
  res.status(200).json({ data: { tasks } });
};

export const createTaskController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  const input = res.locals.body as CreateTaskInput;
  const task = await createTask(projectId, requireActorId(req), input);
  res.status(201).json({ data: { task } });
};

export const getTaskController: RequestHandler = async (req, res) => {
  const { taskId } = res.locals.params as { taskId: string };
  const task = await getTaskDetail(taskId, requireActorId(req));
  res.status(200).json({ data: { task } });
};
