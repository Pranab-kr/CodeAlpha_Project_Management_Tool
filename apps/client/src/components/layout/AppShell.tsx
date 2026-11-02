import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/20">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:ring-3 focus:ring-ring/50"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Layout route: keeps the shell mounted while project pages change. */
export function AppShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
