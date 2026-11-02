import type { ProjectDetail } from "@teamboard/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ApiError } from "../../lib/api";
import { useDeleteProject } from "./useProjects";

export default function DangerZone({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate();
  const mutation = useDeleteProject();
  const [confirmation, setConfirmation] = useState("");

  if (project.role !== "owner") {
    return (
      <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-heading text-base font-medium text-destructive">
          Danger zone
        </h2>
        <p className="text-sm text-muted-foreground">
          Only the project owner can delete this project.
        </p>
        <Button variant="destructive" disabled>
          Delete project
        </Button>
      </div>
    );
  }

  const matches = confirmation === project.name;
  const mismatch = confirmation.length > 0 && !matches;

  const handleDelete = async () => {
    try {
      await mutation.mutateAsync(project.id);
      toast.success("Project deleted");
      navigate("/projects");
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not delete the project. Please try again.",
      );
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-destructive/40 p-6">
      <div>
        <h2 className="font-heading text-base font-medium text-destructive">
          Danger zone
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deleting “{project.name}” permanently removes its board, tasks,
          comments, and notifications. This cannot be undone.
        </p>
      </div>

      <div className="max-w-sm space-y-2">
        <Label htmlFor="confirm-project-name">
          Type the project name to confirm
        </Label>
        <Input
          id="confirm-project-name"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          aria-invalid={mismatch}
        />
        {mismatch ? (
          <p role="alert" className="text-sm text-destructive">
            The name does not match exactly.
          </p>
        ) : null}
      </div>

      <Button
        variant="destructive"
        disabled={!matches || mutation.isPending}
        onClick={() => void handleDelete()}
      >
        {mutation.isPending ? "Deleting…" : "Delete project"}
      </Button>
    </div>
  );
}
