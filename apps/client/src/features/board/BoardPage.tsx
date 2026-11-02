import { Link, useParams, useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { ApiError } from "../../lib/api";
import { initialsColor } from "../../lib/format";
import BoardColumn from "../board/BoardColumn";
import CreateColumnDialog from "../board/CreateColumnDialog";
import TaskDrawer from "../board/TaskDrawer";
import { ProjectError, ProjectNotFound } from "../projects/ProjectStates";
import { useProject } from "../projects/useProjects";
import { useTasks } from "../tasks/useTasks";

function BoardLoading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="w-80 shrink-0 space-y-3 rounded-xl border bg-muted/30 p-3"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading board</span>
    </div>
  );
}

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectQuery = useProject(projectId);
  const tasksQuery = useTasks(projectId);

  const openCreate = (columnId: string) => {
    setSearchParams({ task: "new", column: columnId });
  };
  const openTask = (taskId: string) => {
    setSearchParams({ task: taskId });
  };
  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    next.delete("column");
    setSearchParams(next, { replace: true });
  };

  if (projectQuery.isPending || tasksQuery.isPending) {
    return <BoardLoading />;
  }

  if (projectQuery.isError) {
    if (
      projectQuery.error instanceof ApiError &&
      projectQuery.error.status === 404
    ) {
      return <ProjectNotFound />;
    }
    return <ProjectError onRetry={() => void projectQuery.refetch()} />;
  }

  if (tasksQuery.isError) {
    return <ProjectError onRetry={() => void tasksQuery.refetch()} />;
  }

  const project = projectQuery.data;
  const tasks = tasksQuery.data;
  const canManage = project.role === "owner" || project.role === "admin";
  const taskParam = searchParams.get("task");
  const isCreate = taskParam === "new";
  const createColumnId =
    searchParams.get("column") ?? project.columns[0]?.id ?? null;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <Badge variant="secondary">{project.role}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {project.description || "No description yet."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden -space-x-2 sm:flex">
            {project.members.slice(0, 4).map((member) => (
              <Avatar
                key={member.userId}
                size="sm"
                className="ring-2 ring-background"
                aria-label={member.name}
              >
                <AvatarFallback className={initialsColor(member.userId)}>
                  {member.initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="settings" />}
          >
            Settings
          </Button>
          <Button
            disabled={project.columns.length === 0}
            onClick={() => {
              const first = project.columns[0];
              if (first) openCreate(first.id);
            }}
          >
            Add task
          </Button>
        </div>
      </header>

      {project.columns.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <h2 className="font-heading text-base font-medium">
            This board has no columns yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a column to start collecting tasks.
          </p>
          {canManage ? (
            <div className="mt-4 flex justify-center">
              <CreateColumnDialog projectId={project.id} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {project.columns.map((column, index) => (
            <BoardColumn
              key={column.id}
              project={project}
              column={column}
              index={index}
              tasks={tasks.filter((task) => task.columnId === column.id)}
              canManage={canManage}
              onAddTask={openCreate}
              onOpenTask={openTask}
            />
          ))}
          {canManage ? (
            <div className="w-64 shrink-0">
              <CreateColumnDialog projectId={project.id} />
            </div>
          ) : null}
        </div>
      )}

      <TaskDrawer
        project={project}
        taskId={isCreate ? null : taskParam}
        createColumnId={createColumnId}
        open={taskParam !== null}
        onOpenChange={(next) => {
          if (!next) closeDrawer();
        }}
      />
    </section>
  );
}
