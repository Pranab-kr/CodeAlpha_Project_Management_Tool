import type { TaskCard } from "@teamboard/shared";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../lib/query-keys";
import { invalidateForEvent } from "./query-invalidation";

const projectId = "33333333-3333-4333-8333-333333333333";
const taskId = "44444444-4444-4444-8444-444444444444";

const task: TaskCard = {
  id: taskId,
  projectId,
  columnId: "55555555-5555-4555-8555-555555555555",
  title: "Realtime task",
  priority: "medium",
  dueDate: null,
  position: 1024,
  assignee: null,
  createdBy: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "maya@teamboard.dev",
    name: "Maya Chen",
    initials: "MC",
  },
  commentCount: 0,
  createdAt: "2026-11-02T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

let queryClient: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;
let remove: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  queryClient = new QueryClient();
  invalidate = vi.spyOn(queryClient, "invalidateQueries");
  remove = vi.spyOn(queryClient, "removeQueries");
});

describe("invalidateForEvent", () => {
  it("invalidates task lists, details, and project counts for task writes", () => {
    invalidateForEvent(queryClient, "task:created", { task });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.tasks(projectId),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.task(taskId),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.project(projectId),
    });
  });

  it("invalidates the whole task prefix for task deletion", () => {
    invalidateForEvent(queryClient, "task:deleted", {
      taskId,
      columnId: task.columnId,
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tasks"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.task(taskId),
    });
  });

  it("invalidates projects for column and member events", () => {
    const column = {
      id: "55555555-5555-4555-8555-555555555555",
      projectId,
      name: "QA",
      position: 1024,
      createdAt: "2026-11-02T10:00:00.000Z",
    };

    invalidateForEvent(queryClient, "column:created", { column });
    invalidateForEvent(queryClient, "member:added", {
      member: {
        userId: "11111111-1111-4111-8111-111111111111",
        email: "maya@teamboard.dev",
        name: "Maya Chen",
        initials: "MC",
        role: "member",
        joinedAt: "2026-11-02T10:00:00.000Z",
      },
    });

    expect(invalidate).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    });
  });

  it("invalidates comments, task detail, and task lists for comment events", () => {
    invalidateForEvent(queryClient, "comment:created", {
      taskId,
      comment: {
        id: "66666666-6666-4666-8666-666666666666",
        taskId,
        body: "Hello",
        author: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "maya@teamboard.dev",
          name: "Maya Chen",
          initials: "MC",
        },
        createdAt: "2026-11-02T10:00:00.000Z",
        updatedAt: "2026-11-02T10:00:00.000Z",
      },
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.comments(taskId),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.task(taskId),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tasks"] });
  });

  it("invalidates the project summary and detail for project updates", () => {
    invalidateForEvent(queryClient, "project:updated", {
      project: {
        id: projectId,
        name: "Website Redesign",
        description: "",
        ownerId: "11111111-1111-4111-8111-111111111111",
        memberCount: 2,
        taskCount: 1,
        members: [],
        createdAt: "2026-11-01T10:00:00.000Z",
        updatedAt: "2026-11-02T10:00:00.000Z",
      },
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.projects,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.project(projectId),
    });
  });

  it("removes the project cache and invalidates the list on deletion", () => {
    invalidateForEvent(queryClient, "project:deleted", { projectId });

    expect(remove).toHaveBeenCalledWith({
      queryKey: queryKeys.project(projectId),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.projects,
    });
  });

  it("invalidates projects and notifications for member and notification events", () => {
    invalidateForEvent(queryClient, "member:removed", {
      projectId,
      userId: "11111111-1111-4111-8111-111111111111",
    });
    invalidateForEvent(queryClient, "notification:read", {
      notificationId: "22222222-2222-4222-8222-222222222222",
      readAt: "2026-11-02T10:00:00.000Z",
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.project(projectId),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.notifications,
    });
  });

  it("does nothing for presence updates", () => {
    invalidateForEvent(queryClient, "presence:update", {
      projectId,
      onlineUserIds: [],
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
