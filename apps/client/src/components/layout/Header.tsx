import { BellIcon } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../features/auth/useAuth";
import { useProject } from "../../features/projects/useProjects";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SidebarSheet } from "./Sidebar";

export default function Header() {
  const { user, logout } = useAuth();
  const { projectId } = useParams<{ projectId?: string }>();
  const { data: project } = useProject(projectId);
  const title = projectId ? (project?.name ?? "Project") : "Projects";

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
      <div className="lg:hidden">
        <SidebarSheet />
      </div>

      <span className="truncate text-sm font-medium text-muted-foreground">
        {title}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications land in Phase 5; the slot keeps the header stable. */}
        <Button variant="ghost" size="icon" aria-label="Notifications" disabled>
          <BellIcon aria-hidden="true" />
        </Button>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open user menu"
                  className="rounded-full"
                />
              }
            >
              <Avatar className="size-8">
                <AvatarFallback>{user.initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Base UI group labels must live inside a Menu.Group. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <span className="block text-sm font-medium">{user.name}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
