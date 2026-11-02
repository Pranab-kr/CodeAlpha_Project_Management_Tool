import { Skeleton } from "../ui/skeleton";

export default function PageSkeleton({
  label = "Loading page",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-5xl space-y-4"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
