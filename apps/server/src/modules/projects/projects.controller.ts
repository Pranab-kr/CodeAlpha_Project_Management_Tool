import type { CreateProjectInput } from "@teamboard/shared";
import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createProject,
  getProjectDetail,
  listProjects,
} from "./projects.service.js";

function actorId(req: Parameters<RequestHandler>[0]): string {
  const userId = req.user?.id;
  if (!userId) throw AppError.unauthorized();
  return userId;
}

export const listProjectsController: RequestHandler = async (req, res) => {
  const projects = await listProjects(actorId(req));
  res.status(200).json({ data: { projects } });
};

export const createProjectController: RequestHandler = async (req, res) => {
  const input = res.locals.body as CreateProjectInput;
  const project = await createProject(input, actorId(req));
  res.status(201).json({ data: { project } });
};

export const getProjectController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  const project = await getProjectDetail(projectId, actorId(req));
  res.status(200).json({ data: { project } });
};
