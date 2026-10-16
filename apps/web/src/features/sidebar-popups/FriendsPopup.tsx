import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFriendsStore } from "../friends/useFriendsStore";
import { Button } from "../../components/ui/Button";

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
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm font-medium text-text-primary">
            {t("popups.friends.emptyTitle")}
          </p>
          <p className="text-xs text-text-secondary">
            {t("popups.friends.emptyBody")}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { navigate("/friends"); }}
          >
            {t("popups.friends.findFriendsButton")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {visibleFriends.map((friend) => (
            <button
              key={friend.userId}
              type="button"
              onClick={() => { navigate("/friends"); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-elevated transition-colors text-left w-full"
            >
              <span
                className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                  friend.online
                    ? "bg-success"
                    : "border border-text-muted bg-transparent"
                }`}
                aria-hidden="true"
              />
              <span className="text-sm text-text-primary truncate">{friend.nickname}</span>
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
