import { Navigate, Outlet } from "react-router-dom";
import { Loader2Icon } from "lucide-react";
import { useAuth } from "../features/auth/useAuth";

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center"
      >
        <Loader2Icon
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <span className="sr-only">Loading your session</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
