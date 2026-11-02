import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  PhasePlaceholder,
  ProjectError,
  ProjectHeading,
  ProjectLoading,
  ProjectNotFound,
} from "../features/projects/ProjectStates";
import { useProject } from "../features/projects/useProjects";
import { ApiError } from "../lib/api";

export default function ProjectHomePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    data: project,
    isPending,
    isError,
    error,
    refetch,
  } = useProject(projectId);

  if (isPending) return <ProjectLoading />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return <ProjectNotFound />;
    }
    return <ProjectError onRetry={() => void refetch()} />;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <ProjectHeading
        name={project.name}
        description={project.description}
        role={project.role}
      />

      <PhasePlaceholder
        title="Board and tasks arrive in Phase 3"
        body="The project, its members, and its three default columns are ready. The Kanban board and task drawer land in the next phase."
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" render={<Link to="/projects" />}>
          Back to projects
        </Button>
        <Button render={<Link to="settings" />}>Project settings</Button>
      </div>
    </section>
  );
}
