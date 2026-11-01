import { MenuIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";

export function SidebarNav() {
  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      <Link
        to="/projects"
        className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        Projects
      </Link>
      <span className="rounded-md px-3 py-2 text-sm text-muted-foreground">
        New project arrives in Phase 2
      </span>
    </nav>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card p-4 lg:flex">
      <div className="mb-6 px-2">
        <p className="text-lg font-semibold tracking-tight">CodeAlpha</p>
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
          <SheetTitle>CodeAlpha</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <SidebarNav />
        </div>
      </SheetContent>
    </Sheet>
  );
}
