import { useEffect, useState } from "react";
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

const MODES: Mode[] = ["Bullet", "Blitz", "Rapid", "Classical"];
const COLORS: { value: ChallengeColor; label: string }[] = [
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
  { value: "random", label: "Random" },
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
  const { secondsLeft } = useChallenge(expiresAt);
  return (
    <>
      <DialogTitle>Waiting for {targetNickname}</DialogTitle>
      <p className="text-sm text-text-secondary mt-3">
        Challenge sent ({formatSeconds(secondsLeft)})
      </p>
      <div className="flex justify-end mt-6">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel challenge
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
  const outboundChallenge = useFriendsStore((s) => s.outboundChallenge);
  const sendChallenge = useFriendsStore((s) => s.sendChallenge);
  const cancelOutboundChallenge = useFriendsStore((s) => s.cancelOutboundChallenge);

  const [localMode, setLocalMode] = useState<Mode>("Blitz");
  const [localColor, setLocalColor] = useState<ChallengeColor>("white");

  // Reset local state when modal opens fresh (new challenge target).
  useEffect(() => {
    if (outboundChallenge !== null && outboundChallenge.sentAt === 0) {
      setLocalMode("Blitz");
      setLocalColor("white");
    }
  }, [outboundChallenge?.targetUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (outboundChallenge === null) return null;

  const { targetNickname, sentAt, expiresAt, status } = outboundChallenge;
  const isOpen = true;

  function handleOpenChange(open: boolean): void {
    if (!open) cancelOutboundChallenge();
  }

  function handleSend(): void {
    sendChallenge(localMode, localColor);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        {status === "declined" ? (
          <AutoCloseContent
            message={`${targetNickname} declined your challenge`}
            onClose={cancelOutboundChallenge}
          />
        ) : status === "expired" ? (
          <AutoCloseContent
            message="Challenge expired"
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
            <DialogTitle>Challenge {targetNickname}</DialogTitle>

            {/* Mode selector */}
            <div className="mt-4">
              <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">Mode</p>
              <div className="grid grid-cols-4 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLocalMode(m)}
                    className={[
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      localMode === m
                        ? "bg-accent text-text-inverse border-accent"
                        : "bg-transparent border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary",
                    ].join(" ")}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Color selector */}
            <div className="mt-4">
              <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">Color</p>
              <div className="grid grid-cols-3 gap-2">
                {COLORS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLocalColor(value)}
                    className={[
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      localColor === value
                        ? "bg-accent text-text-inverse border-accent"
                        : "bg-transparent border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" size="sm" onClick={cancelOutboundChallenge}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSend}>
                Send challenge
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
