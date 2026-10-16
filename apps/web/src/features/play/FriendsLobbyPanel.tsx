import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { FriendListItem } from "@yanchess/shared";
import { useFriendsStore } from "../friends/useFriendsStore";
import { InlineChallengeForm } from "./InlineChallengeForm";
import { Button } from "../../components/ui/Button";
import { UserFlag } from "../profile/UserFlag";
import { Card } from "../../components/ui/Card";

type View = "list" | "challenge";

export function FriendsLobbyPanel(): JSX.Element {
  const { t } = useTranslation("game");
  const friends = useFriendsStore((s) => s.friends);

  const [view, setView] = useState<View>("list");
  const [selectedFriend, setSelectedFriend] = useState<FriendListItem | null>(null);

  function handleChallenge(friend: FriendListItem): void {
    setSelectedFriend(friend);
    setView("challenge");
  }

  function backToList(): void {
    setView("list");
    setSelectedFriend(null);
  }

  if (view === "challenge" && selectedFriend !== null) {
    return (
      <Card variant="glass" padding="md">
        <InlineChallengeForm
          friend={selectedFriend}
          onSent={backToList}
          onBack={backToList}
        />
      </Card>
    );
  }

  return (
    <Card variant="glass" padding="md">
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        {t("play.friend.friendsListTitle")}
      </h2>

      {friends.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-text-secondary max-w-sm">
            {t("play.friend.emptyState")}
          </p>
          <Link
            to="/friends"
            className="text-sm text-accent hover:underline"
          >
            /friends
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {friends.map((friend) => (
            <div
              key={friend.userId}
              className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-elevated border border-border-subtle"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    friend.online
                      ? "bg-success"
                      : "border border-text-muted bg-transparent"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-text-primary">
                  {friend.nickname}<UserFlag country={friend.country} className="ml-1" />
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleChallenge(friend)}
              >
                {t("play.friend.challengeButton")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
