import { ArrowLeftIcon } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for does not exist or has moved.
        </p>
        <Link
          to="/projects"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to projects
        </Link>
      </section>
    </main>
  );
}
