import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { useFriendsStore } from "../friends/useFriendsStore";
import { UserIdentity } from "../profile/UserIdentity";
import { EmptyState } from "../../components/ui/EmptyState";

const MAX_ROWS = 10;

export function FriendsPopup(): JSX.Element {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const friends = useFriendsStore((s) => s.friends);

  const visibleFriends = friends.slice(0, MAX_ROWS);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-text-primary">
        {t("popups.friends.title")} ({friends.length})
      </h2>

      {friends.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("popups.friends.emptyTitle")}
          description={t("popups.friends.emptyBody")}
          actions={[{ label: t("popups.friends.findFriendsButton"), to: "/friends", variant: "primary" }]}
        />
      ) : (
        <div className="flex flex-col gap-1">
          {visibleFriends.map((friend) => (
            <button
              key={friend.userId}
              type="button"
              onClick={() => { navigate("/friends"); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-elevated transition-colors text-left w-full"
            >
              <UserIdentity nickname={friend.nickname} country={friend.country} online={friend.online} size="sm" />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => { navigate("/friends"); }}
        className="text-xs text-accent hover:underline text-left mt-1"
      >
        {t("popups.friends.openFullPage")}
      </button>
    </div>
  );
}
