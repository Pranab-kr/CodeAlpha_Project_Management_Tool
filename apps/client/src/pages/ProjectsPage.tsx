import EmptyState from "../components/states/EmptyState";
import ErrorState from "../components/states/ErrorState";
import PageSkeleton from "../components/states/PageSkeleton";
import ProjectCard from "../features/projects/ProjectCard";
import NewProjectDialog from "../features/projects/NewProjectDialog";
import { useProjects } from "../features/projects/useProjects";

export default function ProjectsPage() {
  const { data: projects, isPending, isError, refetch } = useProjects();

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every project has a board, members, and tasks.
          </p>
        </div>
        <NewProjectDialog />
      </header>

      {isPending ? (
        <PageSkeleton label="Loading projects" />
      ) : isError ? (
        <ErrorState
          title="Could not load your projects"
          onRetry={() => void refetch()}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Start your first project"
          description="A project includes a three-column board, a member list, and task cards you can move as work progresses."
          action={<NewProjectDialog triggerLabel="Create a project" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  );
}
