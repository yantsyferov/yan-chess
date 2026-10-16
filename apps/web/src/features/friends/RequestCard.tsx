import { useTranslation } from "react-i18next";
import type { FriendRequestItem } from "@yanchess/shared";
import { useFriendsStore } from "./useFriendsStore";
import { UserFlag } from "../profile/UserFlag";

interface RequestCardProps {
  item: FriendRequestItem;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

export function RequestCard({ item }: RequestCardProps): JSX.Element {
  const { t } = useTranslation("friends");

  function handleAccept(): void {
    void useFriendsStore.getState().acceptRequest(item.friendshipId);
  }

  function handleDecline(): void {
    void useFriendsStore.getState().declineRequest(item.friendshipId);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-elevated border border-border-subtle">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary">{item.requesterNickname}<UserFlag country={item.requesterCountry} className="ml-1" /></span>
        <span
          className="text-xs text-text-muted"
          title={item.createdAt}
        >
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAccept}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent text-text-inverse hover:opacity-90 transition-opacity"
        >
          {t("requests.accept")}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-surface-overlay text-text-secondary border border-border-subtle hover:bg-surface-elevated transition-colors"
        >
          {t("requests.decline")}
        </button>
      </div>
    </div>
  );
}
