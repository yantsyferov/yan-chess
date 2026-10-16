import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FriendListItem } from "@yanchess/shared";
import type { Mode, ChallengeColor } from "@yanchess/shared";
import { useFriendsStore } from "../friends/useFriendsStore";
import { UserIdentity } from "../profile/UserIdentity";
import { Button } from "../../components/ui/Button";

const MODES: Mode[] = ["Bullet", "Blitz", "Rapid", "Classical"];
const COLORS: { value: ChallengeColor; labelKey: string }[] = [
  { value: "white", labelKey: "challenge.white" },
  { value: "black", labelKey: "challenge.black" },
  { value: "random", labelKey: "challenge.random" },
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

  const segmentBase =
    "px-3 py-2 rounded-lg text-sm font-medium border transition-colors";
  const segmentActive = "bg-accent text-text-inverse border-accent";
  const segmentInactive =
    "bg-transparent border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary";

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
      <div>
        <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">
          {tFriends("challenge.mode")}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[segmentBase, mode === m ? segmentActive : segmentInactive].join(" ")}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Rated / Casual */}
      <div>
        <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">
          {t("play.online.rated.label")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([true, false] as const).map((rated) => (
            <button
              key={String(rated)}
              type="button"
              onClick={() => setIsRated(rated)}
              className={[segmentBase, isRated === rated ? segmentActive : segmentInactive].join(" ")}
            >
              {rated ? t("play.online.rated.rated") : t("play.online.rated.casual")}
            </button>
          ))}
        </div>
      </div>

      {/* Color selector */}
      <div>
        <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">
          {tFriends("challenge.color")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {COLORS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => setColor(value)}
              className={[segmentBase, color === value ? segmentActive : segmentInactive].join(" ")}
            >
              {tFriends(labelKey)}
            </button>
          ))}
        </div>
      </div>

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
