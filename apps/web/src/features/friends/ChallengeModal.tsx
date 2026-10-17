import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Mode } from "@yanchess/shared";
import type { ChallengeColor } from "@yanchess/shared";
import { useFriendsStore } from "./useFriendsStore";
import { useChallenge } from "./useChallenge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { ToggleGroup } from "../../components/ui/ToggleGroup";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "Bullet", label: "Bullet" },
  { value: "Blitz", label: "Blitz" },
  { value: "Rapid", label: "Rapid" },
  { value: "Classical", label: "Classical" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

function WaitingContent({
  targetNickname,
  expiresAt,
  onCancel,
}: {
  targetNickname: string;
  expiresAt: number;
  onCancel: () => void;
}): JSX.Element {
  const { t } = useTranslation("friends");
  const { secondsLeft } = useChallenge(expiresAt);
  return (
    <>
      <DialogTitle>{t("challenge.waiting", { nickname: targetNickname })}</DialogTitle>
      <p className="text-sm text-text-secondary mt-3">
        {t("challenge.sent", { timer: formatSeconds(secondsLeft) })}
      </p>
      <div className="flex justify-end mt-6">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {t("challenge.cancelChallenge")}
        </Button>
      </div>
    </>
  );
}

function AutoCloseContent({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}): JSX.Element {
  useEffect(() => {
    const id = setTimeout(onClose, 2000);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <p className="text-sm text-text-secondary py-2">{message}</p>
  );
}

export function ChallengeModal(): JSX.Element | null {
  const { t } = useTranslation("friends");
  const { t: tGame } = useTranslation("game");
  const outboundChallenge = useFriendsStore((s) => s.outboundChallenge);
  const sendChallenge = useFriendsStore((s) => s.sendChallenge);
  const cancelOutboundChallenge = useFriendsStore((s) => s.cancelOutboundChallenge);

  const [localMode, setLocalMode] = useState<Mode>("Blitz");
  const [localColor, setLocalColor] = useState<ChallengeColor>("white");
  const [localIsRated, setLocalIsRated] = useState<boolean>(true);

  // Reset local state when modal opens fresh (new challenge target).
  useEffect(() => {
    if (outboundChallenge !== null && outboundChallenge.sentAt === 0) {
      setLocalMode("Blitz");
      setLocalColor("white");
      setLocalIsRated(true);
    }
  }, [outboundChallenge?.targetUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (outboundChallenge === null) return null;

  const { targetNickname, sentAt, expiresAt, status } = outboundChallenge;
  const isOpen = true;

  const COLORS: { value: ChallengeColor; label: string }[] = [
    { value: "white", label: t("challenge.white") },
    { value: "black", label: t("challenge.black") },
    { value: "random", label: t("challenge.random") },
  ];

  function handleOpenChange(open: boolean): void {
    if (!open) cancelOutboundChallenge();
  }

  function handleSend(): void {
    sendChallenge(localMode, localColor, localIsRated);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        {status === "declined" ? (
          <AutoCloseContent
            message={t("challenge.declined", { nickname: targetNickname })}
            onClose={cancelOutboundChallenge}
          />
        ) : status === "expired" ? (
          <AutoCloseContent
            message={t("challenge.expired")}
            onClose={cancelOutboundChallenge}
          />
        ) : sentAt > 0 ? (
          <WaitingContent
            targetNickname={targetNickname}
            expiresAt={expiresAt}
            onCancel={cancelOutboundChallenge}
          />
        ) : (
          <>
            <DialogTitle>{t("challenge.title", { nickname: targetNickname })}</DialogTitle>

            {/* Mode selector */}
            <div className="mt-4">
              <ToggleGroup
                value={localMode}
                onChange={setLocalMode}
                options={MODE_OPTIONS}
                label={t("challenge.mode")}
                variant="segment"
                layout="grid"
                gridCols={4}
              />
            </div>

            {/* Color selector */}
            <div className="mt-4">
              <ToggleGroup
                value={localColor}
                onChange={setLocalColor}
                options={COLORS}
                label={t("challenge.color")}
                variant="segment"
                layout="grid"
                gridCols={3}
              />
            </div>

            {/* Rated / Casual selector */}
            <div className="mt-4">
              <ToggleGroup
                value={localIsRated}
                onChange={setLocalIsRated}
                options={[
                  { value: true, label: tGame("play.online.rated.rated") },
                  { value: false, label: tGame("play.online.rated.casual") },
                ]}
                label={tGame("play.online.rated.label")}
                variant="segment"
                layout="grid"
                gridCols={2}
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" size="sm" onClick={cancelOutboundChallenge}>
                {t("challenge.cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSend}>
                {t("challenge.send")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
