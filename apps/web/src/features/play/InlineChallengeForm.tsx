import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FriendListItem } from "@yanchess/shared";
import type { Mode, ChallengeColor } from "@yanchess/shared";
import { useFriendsStore } from "../friends/useFriendsStore";
import { UserIdentity } from "../profile/UserIdentity";
import { Button } from "../../components/ui/Button";
import { ToggleGroup } from "../../components/ui/ToggleGroup";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "Bullet", label: "Bullet" },
  { value: "Blitz", label: "Blitz" },
  { value: "Rapid", label: "Rapid" },
  { value: "Classical", label: "Classical" },
];

interface InlineChallengeFormProps {
  friend: FriendListItem;
  onSent: () => void;
  onBack: () => void;
}

export function InlineChallengeForm({ friend, onSent, onBack }: InlineChallengeFormProps): JSX.Element {
  const { t } = useTranslation("game");
  const { t: tFriends } = useTranslation("friends");

  const [mode, setMode] = useState<Mode>("Blitz");
  const [isRated, setIsRated] = useState(true);
  const [color, setColor] = useState<ChallengeColor>("random");

  const openChallenge = useFriendsStore((s) => s.openChallenge);
  const sendChallenge = useFriendsStore((s) => s.sendChallenge);

  function handleSend(): void {
    openChallenge(friend.userId, friend.nickname);
    sendChallenge(mode, color, isRated);
    toast.success(t("play.friend.challengeSent", "Challenge sent"));
    onSent();
  }

  function handleChallengeLink(): void {
    toast.info(t("play.friend.challengeLinkComingSoon"));
  }

  const colorOptions: { value: ChallengeColor; label: string }[] = [
    { value: "white", label: tFriends("challenge.white") },
    { value: "black", label: tFriends("challenge.black") },
    { value: "random", label: tFriends("challenge.random") },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserIdentity nickname={friend.nickname} country={friend.country} online={friend.online} size="md" />
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-accent hover:underline self-start"
      >
        {t("play.friend.backToList")}
      </button>

      {/* Mode selector */}
      <ToggleGroup
        value={mode}
        onChange={setMode}
        options={MODE_OPTIONS}
        label={tFriends("challenge.mode")}
        variant="segment"
        layout="grid"
        gridCols={4}
      />

      {/* Rated / Casual */}
      <ToggleGroup
        value={isRated}
        onChange={setIsRated}
        options={[
          { value: true, label: t("play.online.rated.rated") },
          { value: false, label: t("play.online.rated.casual") },
        ]}
        label={t("play.online.rated.label")}
        variant="segment"
        layout="grid"
        gridCols={2}
      />

      {/* Color selector */}
      <ToggleGroup
        value={color}
        onChange={setColor}
        options={colorOptions}
        label={tFriends("challenge.color")}
        variant="segment"
        layout="grid"
        gridCols={3}
      />

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-2">
        <Button variant="primary" size="md" onClick={handleSend}>
          {t("play.friend.sendChallenge")}
        </Button>
        <Button variant="secondary" size="md" onClick={handleChallengeLink}>
          {t("play.friend.challengeLink")}
        </Button>
      </div>
    </div>
  );
}
