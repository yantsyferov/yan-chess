import { useTranslation } from "react-i18next";
import { useFriendsStore } from "./useFriendsStore";
import { useChallenge } from "./useChallenge";
import { UserFlag } from "../profile/UserFlag";
import { Button } from "../../components/ui/Button";

function RatedBadge({ isRated }: { isRated: boolean }): JSX.Element {
  const { t } = useTranslation("game");
  return (
    <span className={[
      "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
      isRated
        ? "bg-accent/20 text-accent"
        : "bg-surface-alt text-text-secondary",
    ].join(" ")}>
      {isRated ? t("history.ratedBadge") : t("history.casualBadge")}
    </span>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

function ChallengeToastInner(): JSX.Element {
  const { t } = useTranslation("friends");
  const inboundChallenge = useFriendsStore((s) => s.inboundChallenge)!;
  const respondInboundChallenge = useFriendsStore((s) => s.respondInboundChallenge);
  const { secondsLeft } = useChallenge(inboundChallenge.expiresAt);

  return (
    <div className="fixed top-4 right-4 z-50 bg-surface-overlay backdrop-blur-[16px] border border-border-subtle rounded-xl shadow-lg p-4 max-w-sm w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-2 mb-1">
        <RatedBadge isRated={inboundChallenge.isRated} />
        <span className="text-sm font-medium text-text-primary">
          {inboundChallenge.challengerNickname}
          <UserFlag country={inboundChallenge.challengerCountry} className="ml-1" />
        </span>
      </div>
      <p className="text-sm text-text-primary">
        {t("inboundChallenge.challenges", {
          nickname: inboundChallenge.challengerNickname,
          mode: inboundChallenge.mode,
          timer: formatSeconds(secondsLeft),
        })}
      </p>
      <div className="flex gap-2 mt-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => respondInboundChallenge(true)}
        >
          {t("inboundChallenge.accept")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => respondInboundChallenge(false)}
        >
          {t("inboundChallenge.decline")}
        </Button>
      </div>
    </div>
  );
}

export function ChallengeToast(): JSX.Element | null {
  const inboundChallenge = useFriendsStore((s) => s.inboundChallenge);
  if (inboundChallenge === null) return null;
  return <ChallengeToastInner />;
}
