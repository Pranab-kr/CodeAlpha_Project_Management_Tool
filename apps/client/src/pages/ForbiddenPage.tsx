import { ArrowLeftIcon } from "lucide-react";
import { Link } from "react-router-dom";

export default function ForbiddenPage() {
  return (
    <section className="mx-auto max-w-xl rounded-xl border bg-card p-10 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        You don't have access
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask a project owner or admin if you think you should be able to see
        this.
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
