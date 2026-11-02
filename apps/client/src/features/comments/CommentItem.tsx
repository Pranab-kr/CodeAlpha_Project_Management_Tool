import type { Comment } from "@teamboard/shared";
import { commentBodySchema } from "@teamboard/shared";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { formatRelativeTime, initialsColor } from "../../lib/format";

export default function CommentItem({
  comment,
  isOwn,
  canModerate,
  onUpdate,
  onDelete,
}: {
  comment: Comment;
  isOwn: boolean;
  canModerate: boolean;
  onUpdate: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(comment.body);
  }, [comment.body, editing]);

  const save = async () => {
    const parsed = commentBodySchema.safeParse({ body: draft });
    if (!parsed.success) {
      setError("Write a comment first.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onUpdate(comment.id, parsed.data.body);
    } catch {
      // The mutation hook toasts the failure and the body stays unchanged.
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } catch {
      // The mutation hook toasts the failure.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li className="space-y-2">
      <div className="flex items-start gap-2">
        <Avatar size="sm" aria-label={comment.author.name}>
          <AvatarFallback className={initialsColor(comment.author.id)}>
            {comment.author.initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">{comment.author.name}</span>
            <time
              dateTime={comment.createdAt}
              className="text-xs text-muted-foreground"
            >
              {formatRelativeTime(comment.createdAt)}
            </time>
            {comment.updatedAt !== comment.createdAt ? (
              <span className="text-xs text-muted-foreground">(edited)</span>
            ) : null}
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                aria-label="Edit comment body"
                rows={3}
                value={draft}
                disabled={saving}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) setError(null);
                }}
              />
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft(comment.body);
                    setError(null);
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {comment.body}
            </p>
          )}
        </div>
      </div>

      {!editing && (isOwn || canModerate) ? (
        <div className="flex gap-1 pl-9">
          {isOwn ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Edit comment"
              onClick={() => {
                setDraft(comment.body);
                setError(null);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          ) : null}

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="sm" aria-label="Delete comment" />
              }
            >
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void remove()}
                  disabled={deleting}
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </li>
  );
}
