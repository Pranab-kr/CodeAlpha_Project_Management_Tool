import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { useAuth } from "../auth/useAuth";
import CommentComposer from "./CommentComposer";
import CommentItem from "./CommentItem";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "./useComments";

export default function CommentsSection({
  taskId,
  projectId,
  canModerate,
}: {
  taskId: string;
  projectId: string;
  canModerate: boolean;
}) {
  const { user } = useAuth();
  const commentsQuery = useComments(taskId);
  const createMutation = useCreateComment(taskId, projectId);
  const updateMutation = useUpdateComment(taskId, projectId);
  const deleteMutation = useDeleteComment(taskId, projectId);

  const comments = commentsQuery.data ?? [];

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 id="comments-heading" className="text-sm font-medium">
          Comments
        </h3>
        {commentsQuery.isSuccess ? (
          <Badge variant="secondary">{comments.length}</Badge>
        ) : null}
      </div>

      {commentsQuery.isPending ? (
        <div role="status" aria-label="Loading comments" className="space-y-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : null}

      {commentsQuery.isError ? (
        <div className="text-sm text-muted-foreground">
          <p>Could not load comments.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void commentsQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {commentsQuery.isSuccess && comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Start the conversation.
        </p>
      ) : null}

      {comments.length > 0 ? (
        <ul aria-label="Comments" className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isOwn={comment.author.id === user?.id}
              canModerate={canModerate}
              onUpdate={async (commentId, body) => {
                await updateMutation.mutateAsync({ commentId, body });
              }}
              onDelete={async (commentId) => {
                await deleteMutation.mutateAsync(commentId);
              }}
            />
          ))}
        </ul>
      ) : null}

      <CommentComposer
        onSubmit={async (body) => {
          await createMutation.mutateAsync(body);
        }}
        isPending={createMutation.isPending}
      />
    </section>
  );
}
