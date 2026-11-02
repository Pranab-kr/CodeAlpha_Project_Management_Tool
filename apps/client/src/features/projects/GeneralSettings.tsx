import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateProjectSchema,
  type ProjectDetail,
  type UpdateProjectInput,
} from "@teamboard/shared";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { ApiError } from "../../lib/api";
import { useUpdateProject } from "./useProjects";

export default function GeneralSettings({
  project,
}: {
  project: ProjectDetail;
}) {
  const canEdit = project.role === "owner" || project.role === "admin";
  const mutation = useUpdateProject(project.id);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: { name: project.name, description: project.description },
  });

  useEffect(() => {
    form.reset({ name: project.name, description: project.description });
  }, [project.name, project.description, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await mutation.mutateAsync(values);
      toast.success("Project updated");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Could not save the project. Please try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4" noValidate>
      {!canEdit ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Only the project owner or an admin can edit these details.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="settings-name">Project name</Label>
        <Input
          id="settings-name"
          disabled={!canEdit}
          aria-invalid={Boolean(form.formState.errors.name)}
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-description">Description</Label>
        <Textarea
          id="settings-description"
          rows={4}
          disabled={!canEdit}
          {...form.register("description")}
        />
        {form.formState.errors.description ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.description.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      {canEdit ? (
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      ) : null}
    </form>
  );
}
