import { Button } from "../ui/button";

export default function ErrorState({
  title = "Could not load this page",
  description = "Check your connection and try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <section
      role="alert"
      className="mx-auto max-w-xl rounded-xl border bg-card p-8 text-center"
    >
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </section>
  );
}
