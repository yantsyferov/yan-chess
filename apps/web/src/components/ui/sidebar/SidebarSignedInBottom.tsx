import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Settings, Users, MessageSquare, Bell } from "lucide-react";
import { useAuthStore } from "../../../features/auth/useAuthStore";
import { useFriendsStore } from "../../../features/friends/useFriendsStore";
import { Avatar } from "../Avatar";
import { UserFlag } from "../../../features/profile/UserFlag";
import { IconButton } from "../IconButton";
import { SidebarPopup } from "../../../features/sidebar-popups/SidebarPopup";
import { SettingsPopup } from "../../../features/sidebar-popups/SettingsPopup";
import { FriendsPopup } from "../../../features/sidebar-popups/FriendsPopup";
import { ChatPopup } from "../../../features/sidebar-popups/ChatPopup";
import { NotificationsPopup } from "../../../features/sidebar-popups/NotificationsPopup";

export function SidebarSignedInBottom(): JSX.Element {
  const { t } = useTranslation("common");
  const user = useAuthStore((s) => s.user);
  const pendingRequestsCount = useFriendsStore((s) => s.pendingRequestsCount);

  if (!user) return <></>;

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link
        to="/profile"
        className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors"
      >
        <Avatar nickname={user.nickname} size="sm" />
        <span className="text-sm text-text-primary truncate">{user.nickname}</span>
        <UserFlag country={user.country ?? null} className="ml-1" />
      </Link>

      <div className="flex items-center gap-1">
        <SidebarPopup
          id="settings"
          trigger={
            <IconButton
              label={t("sidebar.settings")}
              variant="ghost"
              size="sm"
            >
              <Settings size={18} aria-hidden />
            </IconButton>
          }
        >
          <SettingsPopup />
        </SidebarPopup>

        <div className="relative">
          <SidebarPopup
            id="friends"
            trigger={
              <IconButton
                label={t("sidebar.friends")}
                variant="ghost"
                size="sm"
              >
                <Users size={18} aria-hidden />
              </IconButton>
            }
          >
            <FriendsPopup />
          </SidebarPopup>
          {pendingRequestsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white pointer-events-none">
              {pendingRequestsCount}
            </span>
          )}
        </div>

        <SidebarPopup
          id="chat"
          trigger={
            <IconButton
              label={t("sidebar.chat")}
              variant="ghost"
              size="sm"
            >
              <MessageSquare size={18} aria-hidden />
            </IconButton>
          }
        >
          <ChatPopup />
        </SidebarPopup>

        <SidebarPopup
          id="notifications"
          trigger={
            <IconButton
              label={t("sidebar.notifications")}
              variant="ghost"
              size="sm"
            >
              <Bell size={18} aria-hidden />
            </IconButton>
          }
        >
          <NotificationsPopup />
        </SidebarPopup>
      </div>
    </div>
  );
}
