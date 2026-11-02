import type { Comment } from "@teamboard/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "../../lib/query-keys";
import { useAuth } from "../auth/useAuth";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "./comments.api";

interface CommentsCache {
  comments: Comment[];
}

interface CreateContext {
  previous?: CommentsCache;
  tempId: string | null;
}

export function useComments(taskId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.comments(taskId ?? ""),
    queryFn: () => listComments(taskId as string),
    enabled: Boolean(taskId),
    select: (data) => data.comments,
  });
}

export function useCreateComment(taskId: string, projectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<{ comment: Comment }, Error, string, CreateContext>({
    mutationFn: (body) => createComment(taskId, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.comments(taskId),
      });
      const previous = queryClient.getQueryData<CommentsCache>(
        queryKeys.comments(taskId),
      );

      let tempId: string | null = null;
      if (user) {
        tempId = `temp-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const optimistic: Comment = {
          id: tempId,
          taskId,
          body,
          author: {
            id: user.id,
            email: user.email,
            name: user.name,
            initials: user.initials,
          },
          createdAt: now,
          updatedAt: now,
        };
        queryClient.setQueryData<CommentsCache>(queryKeys.comments(taskId), {
          comments: [...(previous?.comments ?? []), optimistic],
        });
      }

      return { previous, tempId };
    },
    onError: (_error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.comments(taskId), context.previous);
      } else {
        queryClient.setQueryData<CommentsCache>(
          queryKeys.comments(taskId),
          (current) => ({
            comments: (current?.comments ?? []).filter(
              (comment) => comment.id !== context?.tempId,
            ),
          }),
        );
      }
      toast.error("Could not post the comment");
    },
    onSuccess: ({ comment }, _body, context) => {
      queryClient.setQueryData<CommentsCache>(
        queryKeys.comments(taskId),
        (current) => ({
          comments: (current?.comments ?? []).map((item) =>
            item.id === context?.tempId ? comment : item,
          ),
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.task(taskId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(projectId),
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.comments(taskId),
      });
    },
  });
}

export function useUpdateComment(taskId: string, _projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      updateComment(commentId, body),
    onSuccess: ({ comment }) => {
      queryClient.setQueryData<CommentsCache>(
        queryKeys.comments(taskId),
        (current) => ({
          comments: (current?.comments ?? []).map((item) =>
            item.id === comment.id ? comment : item,
          ),
        }),
      );
    },
    onError: () => {
      toast.error("Could not save the comment");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.comments(taskId),
      });
    },
  });
}

export function useDeleteComment(taskId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (_result, commentId) => {
      queryClient.setQueryData<CommentsCache>(
        queryKeys.comments(taskId),
        (current) => ({
          comments: (current?.comments ?? []).filter(
            (comment) => comment.id !== commentId,
          ),
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.task(taskId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(projectId),
      });
    },
    onError: () => {
      toast.error("Could not delete the comment");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.comments(taskId),
      });
    },
  });
}
