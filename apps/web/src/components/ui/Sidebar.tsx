import { Play } from "lucide-react";
import { useAuthStore } from "../../features/auth/useAuthStore";
import { SidebarLogo } from "./sidebar/SidebarLogo";
import { SidebarMenu } from "./sidebar/SidebarMenu";
import { SidebarAnonymousBottom } from "./sidebar/SidebarAnonymousBottom";
import { SidebarSignedInBottom } from "./sidebar/SidebarSignedInBottom";

const NAV_ITEMS = [
  { path: "/play", labelKey: "common:sidebar.play", icon: Play },
] as const;

export function Sidebar(): JSX.Element {
  const user = useAuthStore((s) => s.user);

  return (
    <aside
      role="navigation"
      aria-label="Sidebar"
      className="flex flex-col h-screen w-[var(--sidebar-width)] border-r border-border-subtle bg-surface-base"
    >
      <div className="p-4">
        <SidebarLogo />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <SidebarMenu items={NAV_ITEMS} />
      </div>

      <div className="mt-auto">
        {user !== null ? <SidebarSignedInBottom /> : <SidebarAnonymousBottom />}
      </div>
    </aside>
  );
}
