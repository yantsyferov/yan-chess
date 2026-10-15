import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFriendsStore } from "./useFriendsStore";

interface Props {
  id: string;
  requesterNickname: string;
}

export function FriendRequestToast({ id, requesterNickname }: Props): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      useFriendsStore.getState().dismissRequestToast(id);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [id]);

  function handleView(): void {
    void navigate("/friends?tab=requests");
    useFriendsStore.getState().dismissRequestToast(id);
  }

  function handleDismiss(): void {
    useFriendsStore.getState().dismissRequestToast(id);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-surface-overlay backdrop-blur-[16px] border border-border-subtle rounded-xl shadow-lg p-4 max-w-sm w-[calc(100vw-2rem)]"
    >
      <p className="text-sm text-text-primary">
        <span className="font-semibold">{requesterNickname}</span>
        {" wants to be your friend"}
      </p>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleView}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-text-inverse hover:opacity-90 transition-opacity"
        >
          View
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
}
