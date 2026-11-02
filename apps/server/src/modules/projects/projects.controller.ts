import type {
  AddMemberInput,
  CreateProjectInput,
  UpdateMemberRoleInput,
  UpdateProjectInput,
} from "@teamboard/shared";
import type { RequestHandler } from "express";
import { requireActorId } from "../../middleware/auth.js";
import {
  addMember,
  createProject,
  deleteProject,
  getProjectDetail,
  listMembers,
  listProjects,
  removeMember,
  updateMemberRole,
  updateProject,
} from "./projects.service.js";

export const listProjectsController: RequestHandler = async (req, res) => {
  const projects = await listProjects(requireActorId(req));
  res.status(200).json({ data: { projects } });
};

export const createProjectController: RequestHandler = async (req, res) => {
  const input = res.locals.body as CreateProjectInput;
  const project = await createProject(input, requireActorId(req));
  res.status(201).json({ data: { project } });
};

export const getProjectController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  const project = await getProjectDetail(projectId, requireActorId(req));
  res.status(200).json({ data: { project } });
};

export const updateProjectController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  const input = res.locals.body as UpdateProjectInput;
  const project = await updateProject(projectId, requireActorId(req), input);
  res.status(200).json({ data: { project } });
};

export const deleteProjectController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  await deleteProject(projectId, requireActorId(req));
  res.status(204).send();
};

export const listMembersController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  const members = await listMembers(projectId, requireActorId(req));
  res.status(200).json({ data: { members } });
};

export const addMemberController: RequestHandler = async (req, res) => {
  const { projectId } = res.locals.params as { projectId: string };
  const input = res.locals.body as AddMemberInput;
  const member = await addMember(projectId, requireActorId(req), input);
  res.status(201).json({ data: { member } });
};

export const updateMemberRoleController: RequestHandler = async (req, res) => {
  const { projectId, userId } = res.locals.params as {
    projectId: string;
    userId: string;
  };
  const input = res.locals.body as UpdateMemberRoleInput;
  const member = await updateMemberRole(
    projectId,
    requireActorId(req),
    userId,
    input,
  );
  res.status(200).json({ data: { member } });
};

export const removeMemberController: RequestHandler = async (req, res) => {
  const { projectId, userId } = res.locals.params as {
    projectId: string;
    userId: string;
  };
  await removeMember(projectId, requireActorId(req), userId);
  res.status(204).send();
};
