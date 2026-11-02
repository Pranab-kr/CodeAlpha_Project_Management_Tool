import { MenuIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import NewProjectDialog from "../../features/projects/NewProjectDialog";
import { useProjects } from "../../features/projects/useProjects";
import { projectInitials, initialsColor } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";

export function SidebarNav() {
  const { data: projects, isPending, isError, refetch } = useProjects();

  return (
    <nav className="flex flex-1 flex-col gap-4" aria-label="Main">
      <div className="space-y-1">
        <NavLink
          to="/projects"
          end
          className={({ isActive }) =>
            cn(
              "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-foreground"
                : "text-foreground hover:bg-accent",
            )
          }
        >
          Projects
        </NavLink>
      </div>

      <div>
        <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Your projects
        </p>
        <div className="mt-1 space-y-1">
          {isPending ? (
            <div className="space-y-1 px-1">
              <Skeleton className="h-7" />
              <Skeleton className="h-7" />
              <Skeleton className="h-7" />
            </div>
          ) : isError ? (
            <button
              type="button"
              onClick={() => void refetch()}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              Could not load projects. Retry
            </button>
          ) : projects.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No projects yet.
            </p>
          ) : (
            projects.map((project) => (
              <NavLink
                key={project.id}
                to={`/projects/${project.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )
                }
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold",
                    initialsColor(project.id),
                  )}
                  aria-hidden="true"
                >
                  {projectInitials(project.name)}
                </span>
                <span className="truncate">{project.name}</span>
              </NavLink>
            ))
          )}
        </div>
      </div>

      <div className="mt-auto pt-4">
        <NewProjectDialog />
      </div>
    </nav>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card p-4 lg:flex">
      <div className="mb-6 px-2">
        <p className="text-lg font-semibold tracking-tight">TeamBoard</p>
        <p className="text-xs text-muted-foreground">
          Project management, minus the chaos
        </p>
      </div>
      <SidebarNav />
    </aside>
  );
}

export function SidebarSheet() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Open navigation" />
        }
      >
        <MenuIcon aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>TeamBoard</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col px-4 pb-4">
          <SidebarNav />
        </div>
      </SheetContent>
    </Sheet>
  );
}
