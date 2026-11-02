import { createColumnSchema } from "@teamboard/shared";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ApiError } from "../../lib/api";
import { useCreateColumn } from "../tasks/useTasks";

export default function CreateColumnDialog({
  projectId,
}: {
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateColumn(projectId);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setName("");
      setError(null);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = createColumnSchema.safeParse({ name });
    if (!parsed.success) {
      setError("Column names must be 1–60 characters.");
      return;
    }
    try {
      await mutation.mutateAsync(parsed.data);
      toast.success("Column added");
      handleOpenChange(false);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Could not add the column.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        Add column
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a column</DialogTitle>
            <DialogDescription>
              Columns are the board&apos;s statuses, ordered left to right.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <Label htmlFor="new-column-name">Column name</Label>
            <Input
              id="new-column-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Review"
              aria-invalid={Boolean(error)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Adding…" : "Add column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
