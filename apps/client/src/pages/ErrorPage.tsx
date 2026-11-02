import { Button } from "../components/ui/button";

export default function ErrorPage({ onReload }: { onReload: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page crashed unexpectedly. Reload to try again.
        </p>
        <Button className="mt-6" onClick={onReload}>
          Reload
        </Button>
      </section>
    </main>
  );
}
