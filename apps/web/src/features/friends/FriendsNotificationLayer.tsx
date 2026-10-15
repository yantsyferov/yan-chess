import { createPortal } from "react-dom";
import { useFriendsStore } from "./useFriendsStore";
import { ChallengeModal } from "./ChallengeModal";
import { ChallengeToast } from "./ChallengeToast";
import { FriendRequestToast } from "./FriendRequestToast";

export function FriendsNotificationLayer(): JSX.Element | null {
  const requestToasts = useFriendsStore((s) => s.requestToasts);
  const inboundChallenge = useFriendsStore((s) => s.inboundChallenge);
  const outboundChallenge = useFriendsStore((s) => s.outboundChallenge);

  // SSR safety: skip until mounted in a browser context.
  if (typeof document === "undefined") return null;

  // Nothing to render — avoid creating an empty portal.
  if (requestToasts.length === 0 && inboundChallenge === null && outboundChallenge === null) {
    return null;
  }

  return createPortal(
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {requestToasts.map((t) => (
          <FriendRequestToast
            key={t.id}
            id={t.id}
            requesterNickname={t.requesterNickname}
          />
        ))}
        {inboundChallenge !== null && <ChallengeToast />}
      </div>
      {outboundChallenge !== null && <ChallengeModal />}
    </div>,
    document.body,
  );
}
