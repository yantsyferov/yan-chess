import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Settings, Users, MessageSquare, Bell, LogOut } from "lucide-react";
import { useAuthStore } from "../../../features/auth/useAuthStore";
import * as authService from "../../../features/auth/authService";
import { useFriendsStore } from "../../../features/friends/useFriendsStore";
import { Avatar } from "../Avatar";
import { IconButton } from "../IconButton";
import { ThemeToggle } from "../ThemeToggle";
import { LanguageSwitcher } from "../../../features/i18n/LanguageSwitcher";

export function SidebarSignedInBottom(): JSX.Element {
  const { t } = useTranslation("common");
  const user = useAuthStore((s) => s.user);
  const pendingRequestsCount = useFriendsStore((s) => s.pendingRequestsCount);
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await authService.logout();
    void navigate("/login", { replace: true });
  }

  if (!user) return <></>;

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link
        to="/profile"
        className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors"
      >
        <Avatar nickname={user.nickname} size="sm" />
        <span className="text-sm text-text-primary truncate">{user.nickname}</span>
      </Link>

      <div className="flex items-center gap-1">
        <IconButton
          label={t("sidebar.settings")}
          variant="ghost"
          size="sm"
          onClick={() => {}}
        >
          <Settings size={18} aria-hidden />
        </IconButton>

        <div className="relative">
          <IconButton
            label={t("sidebar.friends")}
            variant="ghost"
            size="sm"
            onClick={() => {}}
          >
            <Users size={18} aria-hidden />
          </IconButton>
          {pendingRequestsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white pointer-events-none">
              {pendingRequestsCount}
            </span>
          )}
        </div>

        <IconButton
          label={t("sidebar.chat")}
          variant="ghost"
          size="sm"
          className="opacity-50 cursor-not-allowed pointer-events-none"
        >
          <MessageSquare size={18} aria-hidden />
        </IconButton>

        <IconButton
          label={t("sidebar.notifications")}
          variant="ghost"
          size="sm"
          onClick={() => {}}
        >
          <Bell size={18} aria-hidden />
        </IconButton>

        {/* REMOVED in spec 015 — moved to Settings popup */}
        <IconButton
          label={t("sidebar.logout")}
          variant="ghost"
          size="sm"
          onClick={() => { void handleLogout(); }}
        >
          <LogOut size={18} aria-hidden />
        </IconButton>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
    </div>
  );
}
