import type {
  BoardColumn,
  ProjectDetail,
  ProjectListItem,
  ProjectMember,
  ProjectRole,
  ProjectSummary,
} from "@teamboard/shared";
import type {
  SelectBoardColumn,
  SelectProject,
  SelectUser,
} from "../../db/schema/index.js";
import { toUserSummary } from "../users/users.mapper.js";

export interface ProjectSummaryRow {
  project: SelectProject;
  memberCount: number;
  taskCount: number;
  previewMembers: SelectUser[];
}

export interface ProjectMemberRow {
  user: SelectUser;
  role: ProjectRole;
  joinedAt: Date;
}

export interface ProjectDetailRow {
  project: SelectProject;
  role: ProjectRole;
  memberCount: number;
  taskCount: number;
  members: ProjectMemberRow[];
  columns: SelectBoardColumn[];
}

export function toBoardColumn(row: SelectBoardColumn): BoardColumn {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toProjectMember(row: ProjectMemberRow): ProjectMember {
  return {
    userId: row.user.id,
    email: row.user.email,
    name: row.user.name,
    initials: toUserSummary(row.user).initials,
    role: row.role,
    joinedAt: row.joinedAt.toISOString(),
  };
}

export function toProjectSummary(row: ProjectSummaryRow): ProjectSummary {
  return {
    id: row.project.id,
    name: row.project.name,
    description: row.project.description,
    ownerId: row.project.ownerId,
    memberCount: row.memberCount,
    taskCount: row.taskCount,
    members: row.previewMembers.slice(0, 4).map(toUserSummary),
    createdAt: row.project.createdAt.toISOString(),
    updatedAt: row.project.updatedAt.toISOString(),
  };
}

export function toProjectListItem(
  row: ProjectSummaryRow,
  role: ProjectRole,
): ProjectListItem {
  return { ...toProjectSummary(row), role };
}

export function toProjectDetail(row: ProjectDetailRow): ProjectDetail {
  return {
    id: row.project.id,
    name: row.project.name,
    description: row.project.description,
    ownerId: row.project.ownerId,
    role: row.role,
    memberCount: row.memberCount,
    taskCount: row.taskCount,
    members: row.members.map(toProjectMember),
    columns: row.columns.map(toBoardColumn),
    createdAt: row.project.createdAt.toISOString(),
    updatedAt: row.project.updatedAt.toISOString(),
  };
}
