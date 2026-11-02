import { ArrowLeftIcon, SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/states/ErrorState";
import ForbiddenPage from "../../pages/ForbiddenPage";
import { Badge } from "../../components/ui/badge";

export function ProjectNotFound() {
  return (
    <section className="mx-auto max-w-xl rounded-xl border bg-card p-10 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        Project not found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This project does not exist or you no longer have access to it.
      </p>
      <Link
        to="/projects"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Back to projects
      </Link>
    </section>
  );
}

export function ProjectForbidden() {
  return <ForbiddenPage />;
}

export function ProjectLoading() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-4"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
      <span className="sr-only">Loading project</span>
    </div>
  );
}

export function ProjectError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="Could not load this project"
      description="Check your connection and try again."
      onRetry={onRetry}
    />
  );
}

export function ProjectHeading({
  name,
  description,
  role,
}: {
  name: string;
  description: string;
  role: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <Badge variant="secondary">{role}</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description || "No description yet."}
        </p>
      </div>
      <Link
        to="settings"
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
      >
        <SettingsIcon className="size-4" aria-hidden="true" />
        Settings
      </Link>
    </div>
  );
}
