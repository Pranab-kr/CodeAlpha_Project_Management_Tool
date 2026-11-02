import type { TaskCard as TaskCardDTO, TaskPriority } from "@teamboard/shared";
import { MessageSquareIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { formatDueDate, initialsColor, isOverdue } from "../../lib/format";
import { cn } from "../../lib/utils";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_VARIANTS: Record<
  TaskPriority,
  "outline" | "secondary" | "destructive"
> = {
  low: "outline",
  medium: "secondary",
  high: "secondary",
  urgent: "destructive",
};

export default function TaskCard({
  task,
  onOpen,
  dragHandleProps,
}: {
  task: TaskCardDTO;
  onOpen?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement> & {
    ref?: React.Ref<HTMLButtonElement>;
  };
}) {
  const overdue = isOverdue(task.dueDate);

  return (
    <button
      type="button"
      {...dragHandleProps}
      onClick={onOpen}
      className={cn(
        "w-full touch-none rounded-lg border bg-card p-3 text-left shadow-xs transition-shadow hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        dragHandleProps?.className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium break-words">{task.title}</p>
        <Badge variant={PRIORITY_VARIANTS[task.priority]}>
          {PRIORITY_LABELS[task.priority]}
        </Badge>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        {task.dueDate ? (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              overdue && "font-medium text-destructive",
            )}
          >
            {overdue ? "Overdue · " : ""}
            {formatDueDate(task.dueDate)}
          </span>
        ) : null}

        <span
          className="ml-auto inline-flex items-center gap-1"
          aria-label={`${task.commentCount} comments`}
        >
          <MessageSquareIcon className="size-3.5" aria-hidden="true" />
          {task.commentCount}
        </span>

        {task.assignee ? (
          <Avatar size="sm" aria-label={`Assigned to ${task.assignee.name}`}>
            <AvatarFallback className={initialsColor(task.assignee.id)}>
              {task.assignee.initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-xs">Unassigned</span>
        )}
      </div>
    </button>
  );
}
