import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Could not load your projects.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <h2 className="font-heading text-lg font-medium">
            Start your first project
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            A project includes a three-column board, a member list, and task
            cards you can move as work progresses.
          </p>
          <div className="mt-5 flex justify-center">
            <NewProjectDialog triggerLabel="Create a project" />
          </div>
        </div>
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
