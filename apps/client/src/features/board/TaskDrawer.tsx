import type { ProjectDetail, TaskPriority } from "@teamboard/shared";
import { createTaskSchema } from "@teamboard/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { Button } from "../../components/ui/button";
import DatePicker from "../../components/ui/date-picker";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { Skeleton } from "../../components/ui/skeleton";
import { Textarea } from "../../components/ui/textarea";
import { ApiError } from "../../lib/api";
import { useAuth } from "../auth/useAuth";
import CommentsSection from "../comments/CommentsSection";
import {
  useCreateTask,
  useDeleteTask,
  useTask,
  useUpdateTask,
} from "../tasks/useTasks";

const taskFormSchema = createTaskSchema.omit({ columnId: true });
type TaskFormInput = z.input<typeof taskFormSchema>;

const PRIORITY_ITEMS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CREATE_DEFAULTS: TaskFormInput = {
  title: "",
  description: "",
  priority: "medium",
  dueDate: null,
  assigneeId: null,
};

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function TaskDrawer({
  project,
  taskId,
  createColumnId,
  open,
  onOpenChange,
}: {
  project: ProjectDetail;
  taskId: string | null;
  createColumnId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isCreate = taskId === null;
  const { user } = useAuth();
  const taskQuery = useTask(isCreate ? null : taskId);
  const createMutation = useCreateTask(project.id);
  const updateMutation = useUpdateTask(project.id);
  const deleteMutation = useDeleteTask(project.id);
  const [serverError, setServerError] = useState<string | null>(null);

  const task = taskQuery.data;

  const form = useForm<TaskFormInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    if (isCreate) {
      form.reset(CREATE_DEFAULTS);
      return;
    }
    if (task) {
      form.reset({
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        assigneeId: task.assignee?.id ?? null,
      });
    }
  }, [open, isCreate, task, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const payload = {
      title: values.title,
      description: values.description ?? "",
      priority: values.priority ?? "medium",
      dueDate: values.dueDate ?? null,
      assigneeId: values.assigneeId ?? null,
    };

    try {
      if (isCreate) {
        if (!createColumnId) {
          setServerError("This board has no column to add the task to.");
          return;
        }
        await createMutation.mutateAsync({
          columnId: createColumnId,
          ...payload,
        });
        toast.success("Task created");
      } else {
        if (!taskId) return;
        await updateMutation.mutateAsync({ taskId, input: payload });
        toast.success("Task updated");
      }
      onOpenChange(false);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  const canDelete =
    !isCreate &&
    task !== undefined &&
    (project.role === "owner" ||
      project.role === "admin" ||
      task.createdBy.id === user?.id);

  const handleDelete = async () => {
    if (!task) return;
    try {
      await deleteMutation.mutateAsync(task.id);
      toast.success("Task deleted");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const dueDate = form.watch("dueDate");
  const priority = form.watch("priority") ?? "medium";
  const assigneeId = form.watch("assigneeId") ?? "unassigned";
  const createColumnName = project.columns.find(
    (column) => column.id === createColumnId,
  )?.name;

  const assigneeItems = [
    { value: "unassigned", label: "Unassigned" },
    ...project.members.map((member) => ({
      value: member.userId,
      label: member.name,
    })),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-[520px]"
      >
        <SheetHeader>
          <SheetTitle>{isCreate ? "New task" : "Task details"}</SheetTitle>
          <SheetDescription>
            {isCreate
              ? `Adding to ${createColumnName ?? "the board"}.`
              : "Edit the fields and save your changes."}
          </SheetDescription>
        </SheetHeader>

        {!isCreate && taskQuery.isPending ? (
          <div className="space-y-3 px-4">
            <Skeleton className="h-8" />
            <Skeleton className="h-24" />
            <Skeleton className="h-8" />
          </div>
        ) : null}

        {!isCreate && taskQuery.isError ? (
          <div className="px-4 text-sm text-muted-foreground">
            <p>Could not load this task.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void taskQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {isCreate || task ? (
          <form onSubmit={onSubmit} className="space-y-4 px-4 pb-6" noValidate>
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                aria-invalid={Boolean(form.formState.errors.title)}
                {...form.register("title")}
              />
              {form.formState.errors.title ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.title.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                rows={5}
                {...form.register("description")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  items={PRIORITY_ITEMS}
                  value={priority}
                  onValueChange={(value) => {
                    if (value) {
                      form.setValue("priority", value as TaskPriority, {
                        shouldValidate: true,
                      });
                    }
                  }}
                >
                  <SelectTrigger id="task-priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due date</Label>
                <DatePicker
                  id="task-due-date"
                  value={dueDate ?? null}
                  onChange={(value) =>
                    form.setValue("dueDate", value, { shouldValidate: true })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                items={assigneeItems}
                value={assigneeId}
                onValueChange={(value) =>
                  form.setValue(
                    "assigneeId",
                    value === null || value === "unassigned" ? null : value,
                    { shouldValidate: true },
                  )
                }
              >
                <SelectTrigger id="task-assignee" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assigneeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {serverError ? (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving…"
                  : isCreate
                    ? "Create task"
                    : "Save changes"}
              </Button>

              {canDelete ? (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button variant="destructive" aria-label="Delete task" />
                    }
                  >
                    Delete task
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The task and its comments will be removed permanently.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void handleDelete()}
                        disabled={deleteMutation.isPending}
                      >
                        Delete permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </form>
        ) : null}

        {isCreate ? (
          <p className="px-4 pb-6 text-sm text-muted-foreground">
            Save the task before commenting.
          </p>
        ) : null}

        {!isCreate && task ? (
          <div className="border-t px-4 py-4">
            <CommentsSection
              taskId={task.id}
              projectId={task.projectId}
              canModerate={project.role !== "member"}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
