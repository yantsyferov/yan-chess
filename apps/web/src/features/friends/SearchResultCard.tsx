import type { FriendSearchItem } from "@yanchess/shared";
import { useFriendsStore } from "./useFriendsStore";

interface SearchResultCardProps {
  item: FriendSearchItem;
}

export function SearchResultCard({ item }: SearchResultCardProps): JSX.Element {
  function handleAddFriend(): void {
    void useFriendsStore.getState().sendFriendRequest(item.userId);
  }

  function handleAcceptRequest(): void {
    if (item.friendshipId) {
      void useFriendsStore.getState().acceptRequest(item.friendshipId);
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-elevated border border-border-subtle">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary">{item.nickname}</span>
        <span className="text-xs text-text-muted">Blitz {item.blitzRating}</span>
      </div>
      <div className="flex items-center">
        {item.relationship === "none" && (
          <button
            type="button"
            onClick={handleAddFriend}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent text-text-inverse hover:opacity-90 transition-opacity"
          >
            Add friend
          </button>
        )}
        {item.relationship === "pending_outbound" && (
          <button
            type="button"
            disabled
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-surface-overlay text-text-muted cursor-not-allowed opacity-70"
          >
            Request pending
          </button>
        )}
        {item.relationship === "pending_inbound" && (
          <button
            type="button"
            onClick={handleAcceptRequest}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent text-text-inverse hover:opacity-90 transition-opacity"
          >
            Accept request
          </button>
        )}
        {item.relationship === "friend" && (
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-surface-overlay text-text-secondary border border-border-subtle">
            Friend
          </span>
        )}
      </div>
    </div>
  );
}
