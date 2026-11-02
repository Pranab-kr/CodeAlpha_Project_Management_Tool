import type {
  BoardColumn as BoardColumnDTO,
  ProjectDetail,
  TaskCard as TaskCardDTO,
} from "@teamboard/shared";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon } from "lucide-react";
import type React from "react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import ColumnMenu from "./ColumnMenu";
import TaskCard from "./TaskCard";

function SortableTaskCard({
  task,
  onOpen,
}: {
  task: TaskCardDTO;
  onOpen: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", columnId: task.columnId },
  });

  return (
    <TaskCard
      task={task}
      onOpen={() => onOpen(task.id)}
      dragHandleProps={{
        ref: setNodeRef,
        role: attributes.role as React.AriaRole,
        tabIndex: attributes.tabIndex,
        "aria-roledescription": attributes["aria-roledescription"],
        "aria-describedby": attributes["aria-describedby"],
        "aria-disabled": attributes["aria-disabled"],
        onPointerDown: listeners?.onPointerDown as
          React.PointerEventHandler<HTMLButtonElement> | undefined,
        onKeyDown: listeners?.onKeyDown as
          React.KeyboardEventHandler<HTMLButtonElement> | undefined,
        style: {
          transform: CSS.Transform.toString(transform),
          transition,
        },
        className: isDragging ? "opacity-40" : undefined,
      }}
    />
  );
}

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
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { type: "column", columnId: column.id },
  });

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

      <div
        ref={setNodeRef}
        className={cn(
          "flex max-h-[calc(100vh-16rem)] flex-col gap-2 overflow-y-auto px-3 pb-3",
          isOver && "bg-accent/40",
        )}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              No tasks yet
            </p>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} onOpen={onOpenTask} />
            ))
          )}
        </SortableContext>

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
