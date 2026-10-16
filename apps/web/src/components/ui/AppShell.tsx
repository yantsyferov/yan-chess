import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SidebarMobileDrawer } from "./sidebar/SidebarMobileDrawer";

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const { pathname } = useLocation();
  const hideChrome = AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );

  if (hideChrome) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <SidebarMobileDrawer />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
