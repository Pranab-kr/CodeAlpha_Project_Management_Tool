import type { TaskCard } from "@teamboard/shared";
import { toast } from "sonner";

export const COLUMN_DROPPABLE_PREFIX = "column:";

export interface DropTarget {
  columnId: string;
  index: number;
  beforeTaskId: string | null;
  afterTaskId: string | null;
}

export interface MoveRequest {
  taskId: string;
  columnId: string;
  beforeTaskId: string | null;
  afterTaskId: string | null;
}

/**
 * Resolves a dnd-kit drop into a column and neighbour ids. Cards are ordered by
 * the API list; the active card is removed before neighbours are computed so a
 * same-column move does not use itself as a neighbour.
 */
export function getDropTarget(
  tasks: TaskCard[],
  activeId: string,
  overId: string,
): DropTarget | null {
  if (activeId === overId) return null;
  if (!tasks.some((task) => task.id === activeId)) return null;

  const isColumn = overId.startsWith(COLUMN_DROPPABLE_PREFIX);
  const columnId = isColumn
    ? overId.slice(COLUMN_DROPPABLE_PREFIX.length)
    : tasks.find((task) => task.id === overId)?.columnId;
  if (!columnId) return null;

  const columnTasks = tasks.filter(
    (task) => task.columnId === columnId && task.id !== activeId,
  );

  const overIndex = isColumn
    ? -1
    : columnTasks.findIndex((task) => task.id === overId);
  if (!isColumn && overIndex === -1) return null;

  let index: number;
  if (isColumn) {
    // Dropping on the column body appends to its end (and index 0 if empty).
    index = columnTasks.length;
  } else if (overIndex === columnTasks.length - 1) {
    // Dropping on the last card places the active card below it.
    index = columnTasks.length;
  } else {
    index = overIndex;
  }

  return {
    columnId,
    index,
    beforeTaskId: index > 0 ? columnTasks[index - 1].id : null,
    afterTaskId: index < columnTasks.length ? columnTasks[index].id : null,
  };
}

/** Reorders the cached list optimistically, preserving other columns' order. */
export function applyOptimisticMove(
  tasks: TaskCard[],
  activeId: string,
  target: DropTarget,
): TaskCard[] {
  const active = tasks.find((task) => task.id === activeId);
  if (!active) return tasks;

  const remaining = tasks.filter((task) => task.id !== activeId);
  const moving: TaskCard = { ...active, columnId: target.columnId };

  let index: number;
  if (target.afterTaskId) {
    index = remaining.findIndex((task) => task.id === target.afterTaskId);
  } else if (target.beforeTaskId) {
    index = remaining.findIndex((task) => task.id === target.beforeTaskId) + 1;
  } else {
    const lastInColumn = remaining.reduce(
      (last, task, taskIndex) =>
        task.columnId === target.columnId ? taskIndex : last,
      -1,
    );
    index = lastInColumn === -1 ? remaining.length : lastInColumn + 1;
  }

  if (index < 0) index = remaining.length;
  return [...remaining.slice(0, index), moving, ...remaining.slice(index)];
}

export async function handleTaskDrop({
  activeId,
  overId,
  tasks,
  applyOptimistic,
  move,
}: {
  activeId: string;
  overId: string | null;
  tasks: TaskCard[];
  applyOptimistic: (next: TaskCard[]) => void;
  move: (request: MoveRequest) => Promise<unknown>;
}): Promise<void> {
  if (!overId) return;
  const target = getDropTarget(tasks, activeId, overId);
  if (!target) return;

  applyOptimistic(applyOptimisticMove(tasks, activeId, target));
  try {
    await move({
      taskId: activeId,
      columnId: target.columnId,
      beforeTaskId: target.beforeTaskId,
      afterTaskId: target.afterTaskId,
    });
  } catch {
    applyOptimistic(tasks);
    toast.error("Could not move the task");
  }
}
