import type {
  AddMemberInput,
  CreateProjectInput,
  UpdateMemberRoleInput,
  UpdateProjectInput,
} from "@teamboard/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import {
  addMember,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  removeMember,
  searchUsers,
  updateMemberRole,
  updateProfile,
  updateProject,
} from "./projects.api";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: listProjects,
    select: (data) => data.projects,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ""),
    queryFn: () => getProject(projectId as string),
    enabled: Boolean(projectId),
    // A 404 is a final answer: show the not-found panel instead of retrying.
    retry: false,
    select: (data) => data.project,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: ({ project }) => {
      queryClient.setQueryData(queryKeys.project(project.id), { project });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(projectId, input),
    onSuccess: ({ project }) => {
      queryClient.setQueryData(queryKeys.project(projectId), { project });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: (_result, projectId) => {
      queryClient.removeQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useAddMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMemberInput) => addMember(projectId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectMembers(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(projectId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateMemberRole(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      input,
    }: {
      userId: string;
      input: UpdateMemberRoleInput;
    }) => updateMemberRole(projectId, userId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectMembers(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(projectId),
      });
    },
  });
}

export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(projectId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectMembers(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(projectId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useSearchUsers(search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: queryKeys.userSearch(term),
    queryFn: () => searchUsers(term),
    enabled: term.length >= 2,
    select: (data) => data.users,
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => updateProfile(name),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(queryKeys.auth, user);
      // Project and member payloads carry initials, so refresh them too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
