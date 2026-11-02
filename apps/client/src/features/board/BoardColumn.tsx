import type {
  BoardColumn as BoardColumnDTO,
  ProjectDetail,
  TaskCard as TaskCardDTO,
} from "@teamboard/shared";
import { PlusIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import ColumnMenu from "./ColumnMenu";
import TaskCard from "./TaskCard";

export default function BoardColumn({
  project,
  column,
  index,
  tasks,
  canManage,
  onAddTask,
  onOpenTask,
}: {
  project: ProjectDetail;
  column: BoardColumnDTO;
  index: number;
  tasks: TaskCardDTO[];
  canManage: boolean;
  onAddTask: (columnId: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <section
      aria-label={`${column.name} column`}
      className="flex w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-xl border bg-muted/30"
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-medium">{column.name}</h2>
          <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        {canManage ? (
          <ColumnMenu
            project={project}
            column={column}
            index={index}
            taskCount={tasks.length}
          />
        ) : null}
      </header>

      <div className="flex max-h-[calc(100vh-16rem)] flex-col gap-2 overflow-y-auto px-3 pb-3">
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            No tasks yet
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={() => onOpenTask(task.id)}
            />
          ))
        )}

        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground"
          onClick={() => onAddTask(column.id)}
        >
          <PlusIcon aria-hidden="true" />
          Add task
        </Button>
      </div>
    </section>
  );
}
