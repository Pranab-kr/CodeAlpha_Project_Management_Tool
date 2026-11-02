import type {
  AddMemberInput,
  CreateProjectInput,
  ProjectDetail,
  ProjectListItem,
  ProjectMember,
  UpdateMemberRoleInput,
  UpdateProjectInput,
  UserDTO,
  UserSummary,
} from "@teamboard/shared";
import { apiFetch } from "../../lib/api";

export function listProjects(): Promise<{ projects: ProjectListItem[] }> {
  return apiFetch<{ projects: ProjectListItem[] }>("/projects");
}

export function getProject(
  projectId: string,
): Promise<{ project: ProjectDetail }> {
  return apiFetch<{ project: ProjectDetail }>(`/projects/${projectId}`);
}

export function createProject(
  input: CreateProjectInput,
): Promise<{ project: ProjectDetail }> {
  return apiFetch<{ project: ProjectDetail }>("/projects", {
    method: "POST",
    body: input,
  });
}

export function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<{ project: ProjectDetail }> {
  return apiFetch<{ project: ProjectDetail }>(`/projects/${projectId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteProject(projectId: string): Promise<void> {
  return apiFetch<void>(`/projects/${projectId}`, { method: "DELETE" });
}

export function listMembers(
  projectId: string,
): Promise<{ members: ProjectMember[] }> {
  return apiFetch<{ members: ProjectMember[] }>(
    `/projects/${projectId}/members`,
  );
}

export function addMember(
  projectId: string,
  input: AddMemberInput,
): Promise<{ member: ProjectMember }> {
  return apiFetch<{ member: ProjectMember }>(`/projects/${projectId}/members`, {
    method: "POST",
    body: input,
  });
}

export function updateMemberRole(
  projectId: string,
  userId: string,
  input: UpdateMemberRoleInput,
): Promise<{ member: ProjectMember }> {
  return apiFetch<{ member: ProjectMember }>(
    `/projects/${projectId}/members/${userId}`,
    { method: "PATCH", body: input },
  );
}

export function removeMember(projectId: string, userId: string): Promise<void> {
  return apiFetch<void>(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function searchUsers(search: string): Promise<{ users: UserSummary[] }> {
  return apiFetch<{ users: UserSummary[] }>(
    `/users?search=${encodeURIComponent(search)}`,
  );
}

export function updateProfile(name: string): Promise<{ user: UserDTO }> {
  return apiFetch<{ user: UserDTO }>("/users/me", {
    method: "PATCH",
    body: { name },
  });
}
