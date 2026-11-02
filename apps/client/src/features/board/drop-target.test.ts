import type { TaskCard } from "@teamboard/shared";
import { describe, expect, it, vi } from "vitest";
import {
  applyOptimisticMove,
  getDropTarget,
  handleTaskDrop,
} from "./drop-target";

function makeTask(id: string, columnId: string, position: number): TaskCard {
  return {
    id,
    projectId: "p1",
    columnId,
    title: `Task ${id}`,
    priority: "medium",
    dueDate: null,
    position,
    assignee: null,
    createdBy: {
      id: "u1",
      email: "maya@teamboard.dev",
      name: "Maya Chen",
      initials: "MC",
    },
    commentCount: 0,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
  };
}

const tasks = [
  makeTask("a", "col-1", 1024),
  makeTask("b", "col-1", 2048),
  makeTask("e", "col-1", 3072),
  makeTask("c", "col-2", 1024),
  makeTask("d", "col-2", 2048),
];

describe("getDropTarget", () => {
  it("computes the column and neighbours for a cross-column card drop", () => {
    expect(getDropTarget(tasks, "a", "d")).toEqual({
      columnId: "col-2",
      index: 2,
      beforeTaskId: "d",
      afterTaskId: null,
    });
  });

  it("appends to an empty column", () => {
    expect(getDropTarget(tasks, "a", "column:col-3")).toEqual({
      columnId: "col-3",
      index: 0,
      beforeTaskId: null,
      afterTaskId: null,
    });
  });

  it("places above the first card and below the last card", () => {
    expect(getDropTarget(tasks, "c", "a")).toEqual({
      columnId: "col-1",
      index: 0,
      beforeTaskId: null,
      afterTaskId: "a",
    });
    expect(getDropTarget(tasks, "a", "d")).toEqual({
      columnId: "col-2",
      index: 2,
      beforeTaskId: "d",
      afterTaskId: null,
    });
  });

  it("returns null when dropping on itself or an unknown target", () => {
    expect(getDropTarget(tasks, "a", "a")).toBeNull();
    expect(getDropTarget(tasks, "a", "missing")).toBeNull();
    expect(getDropTarget(tasks, "missing", "a")).toBeNull();
  });

  it("excludes the active task before computing same-column neighbours", () => {
    expect(getDropTarget(tasks, "a", "b")).toEqual({
      columnId: "col-1",
      index: 0,
      beforeTaskId: null,
      afterTaskId: "b",
    });
  });
});

describe("applyOptimisticMove", () => {
  it("moves a card to the top of its column", () => {
    const target = getDropTarget(tasks, "b", "a");
    expect(target).not.toBeNull();
    const next = applyOptimisticMove(tasks, "b", target!);
    expect(next.map((task) => task.id)).toEqual(["b", "a", "e", "c", "d"]);
  });

  it("updates the column id when moving across columns", () => {
    const target = getDropTarget(tasks, "a", "d");
    expect(target).not.toBeNull();
    const next = applyOptimisticMove(tasks, "a", target!);
    expect(next.find((task) => task.id === "a")?.columnId).toBe("col-2");
    expect(next.map((task) => task.id)).toEqual(["b", "e", "c", "d", "a"]);
  });
});

describe("handleTaskDrop", () => {
  it("applies the optimistic order and sends neighbour ids", async () => {
    const applied: TaskCard[][] = [];
    const move = vi.fn().mockResolvedValue(undefined);

    await handleTaskDrop({
      activeId: "b",
      overId: "a",
      tasks,
      applyOptimistic: (next) => applied.push(next),
      move,
    });

    expect(applied[0].map((task) => task.id)).toEqual([
      "b",
      "a",
      "e",
      "c",
      "d",
    ]);
    expect(move).toHaveBeenCalledWith({
      taskId: "b",
      columnId: "col-1",
      beforeTaskId: null,
      afterTaskId: "a",
    });
  });

  it("restores the original order when the mutation fails", async () => {
    const applied: TaskCard[][] = [];
    const move = vi.fn().mockRejectedValue(new Error("network"));

    await handleTaskDrop({
      activeId: "b",
      overId: "a",
      tasks,
      applyOptimistic: (next) => applied.push(next),
      move,
    });

    expect(applied).toHaveLength(2);
    expect(applied[0].map((task) => task.id)).toEqual([
      "b",
      "a",
      "e",
      "c",
      "d",
    ]);
    expect(applied[1]).toBe(tasks);
  });
});
