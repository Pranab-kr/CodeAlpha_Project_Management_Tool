import type {
  CreateColumnInput,
  CreateTaskInput,
  MoveTaskInput,
  ReorderColumnsInput,
  UpdateColumnInput,
  UpdateTaskInput,
} from "@teamboard/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import {
  createColumn,
  createTask,
  deleteColumn,
  deleteTask,
  getTask,
  listTasks,
  moveTask,
  reorderColumns,
  updateColumn,
  updateTask,
} from "./tasks.api";

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks(projectId ?? ""),
    queryFn: () => listTasks(projectId as string),
    enabled: Boolean(projectId),
    select: (data) => data.tasks,
  });
}

export function useTask(taskId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.task(taskId ?? ""),
    queryFn: () => getTask(taskId as string),
    enabled: Boolean(taskId),
    retry: false,
    select: (data) => data.task,
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(projectId, input),
    onSuccess: ({ task }) => {
      queryClient.setQueryData(queryKeys.task(task.id), { task });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(projectId),
      });
    },
  });
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: UpdateTaskInput;
    }) => updateTask(taskId, input),
    onSuccess: ({ task }) => {
      queryClient.setQueryData(queryKeys.task(task.id), { task });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(projectId),
      });
    },
  });
}

export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...input }: { taskId: string } & MoveTaskInput) =>
      moveTask(taskId, input),
    onSuccess: ({ task }) => {
      queryClient.setQueryData(queryKeys.task(task.id), { task });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(projectId),
      });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: (_result, taskId) => {
      queryClient.removeQueries({ queryKey: queryKeys.task(taskId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(projectId),
      });
    },
  });
}

function useInvalidateBoard(projectId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.project(projectId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.tasks(projectId),
    });
  };
}

export function useCreateColumn(projectId: string) {
  const invalidate = useInvalidateBoard(projectId);
  return useMutation({
    mutationFn: (input: CreateColumnInput) => createColumn(projectId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateColumn(projectId: string) {
  const invalidate = useInvalidateBoard(projectId);
  return useMutation({
    mutationFn: ({
      columnId,
      input,
    }: {
      columnId: string;
      input: UpdateColumnInput;
    }) => updateColumn(columnId, input),
    onSuccess: invalidate,
  });
}

export function useReorderColumns(projectId: string) {
  const invalidate = useInvalidateBoard(projectId);
  return useMutation({
    mutationFn: (input: ReorderColumnsInput) =>
      reorderColumns(projectId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteColumn(projectId: string) {
  const invalidate = useInvalidateBoard(projectId);
  return useMutation({
    mutationFn: (columnId: string) => deleteColumn(columnId),
    onSuccess: invalidate,
  });
}
