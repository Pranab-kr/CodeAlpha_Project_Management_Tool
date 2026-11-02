import { commentBodySchema } from "@teamboard/shared";
import { useId, useState } from "react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";

export default function CommentComposer({
  onSubmit,
  isPending,
}: {
  onSubmit: (body: string) => Promise<void>;
  isPending: boolean;
}) {
  const id = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = commentBodySchema.safeParse({ body });
    if (!parsed.success) {
      setError("Write a comment first.");
      return;
    }
    setError(null);
    try {
      await onSubmit(parsed.data.body);
      setBody("");
    } catch {
      // The mutation hook toasts the failure; keep the draft for a retry.
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="sr-only">
        Comment
      </label>
      <Textarea
        id={id}
        aria-label="Comment"
        placeholder="Write a comment…"
        rows={3}
        value={body}
        disabled={isPending}
        onChange={(event) => {
          setBody(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => void submit()} disabled={isPending}>
          {isPending ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </div>
  );
}
