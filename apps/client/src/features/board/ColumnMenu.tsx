import type {
  BoardColumn as BoardColumnDTO,
  ProjectDetail,
} from "@teamboard/shared";
import { updateColumnSchema } from "@teamboard/shared";
import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ApiError } from "../../lib/api";
import {
  useDeleteColumn,
  useReorderColumns,
  useUpdateColumn,
} from "../tasks/useTasks";

export default function ColumnMenu({
  project,
  column,
  index,
  taskCount,
}: {
  project: ProjectDetail;
  column: BoardColumnDTO;
  index: number;
  taskCount: number;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(column.name);
  const [nameError, setNameError] = useState<string | null>(null);

  const reorder = useReorderColumns(project.id);
  const update = useUpdateColumn(project.id);
  const remove = useDeleteColumn(project.id);

  const isFirst = index === 0;
  const isLast = index === project.columns.length - 1;

  const move = (direction: -1 | 1) => {
    const target = index + direction;
    const ids = project.columns.map((entry) => entry.id);
    if (target < 0 || target >= ids.length) return;

    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    void reorder
      .mutateAsync({ columnIds: next })
      .then(() => toast.success("Column moved"))
      .catch((error) =>
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not move the column.",
        ),
      );
  };

  const submitRename = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = updateColumnSchema.safeParse({ name });
    if (!parsed.success) {
      setNameError("Column names must be 1–60 characters.");
      return;
    }
    try {
      await update.mutateAsync({ columnId: column.id, input: parsed.data });
      toast.success("Column renamed");
      setRenameOpen(false);
      setNameError(null);
    } catch (error) {
      setNameError(
        error instanceof ApiError
          ? error.message
          : "Could not rename the column.",
      );
    }
  };

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(column.id);
      toast.success("Column deleted");
      setDeleteOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not delete the column.",
      );
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Column actions for ${column.name}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={isFirst} onClick={() => move(-1)}>
            Move left
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isLast} onClick={() => move(1)}>
            Move right
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setName(column.name);
              setNameError(null);
              setRenameOpen(true);
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={taskCount > 0}
              onClick={() => setDeleteOpen(true)}
            >
              Delete column
            </DropdownMenuItem>
            {taskCount > 0 ? (
              <DropdownMenuLabel>
                Move or delete this column&apos;s tasks first.
              </DropdownMenuLabel>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={submitRename}>
            <DialogHeader>
              <DialogTitle>Rename column</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-2">
              <Label htmlFor={`column-name-${column.id}`}>Column name</Label>
              <Input
                id={`column-name-${column.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(nameError)}
              />
              {nameError ? (
                <p className="text-sm text-destructive">{nameError}</p>
              ) : null}
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{column.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This column is empty, so deleting it will not remove any tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={remove.isPending}
            >
              Delete column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
