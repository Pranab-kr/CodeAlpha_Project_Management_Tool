import { useParams } from "react-router-dom";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import DangerZone from "../features/projects/DangerZone";
import GeneralSettings from "../features/projects/GeneralSettings";
import MembersPanel from "../features/projects/MembersPanel";
import {
  ProjectError,
  ProjectForbidden,
  ProjectHeading,
  ProjectLoading,
  ProjectNotFound,
} from "../features/projects/ProjectStates";
import { useProject } from "../features/projects/useProjects";
import { ApiError } from "../lib/api";

export default function ProjectSettingsPage() {
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
    if (error instanceof ApiError && error.status === 403) {
      return <ProjectForbidden />;
    }
    return <ProjectError onRetry={() => void refetch()} />;
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <ProjectHeading
        name={project.name}
        description={project.description}
        role={project.role}
      />

      <Tabs defaultValue="general">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="pt-4">
          <GeneralSettings project={project} />
        </TabsContent>
        <TabsContent value="members" className="pt-4">
          <MembersPanel project={project} />
        </TabsContent>
        <TabsContent value="danger" className="pt-4">
          <DangerZone project={project} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
