import type { Mode } from "@yanchess/shared";
import { useAuthStore } from "../auth/useAuthStore";
import { useMatchmakingStore } from "./useMatchmakingStore";
import { useQueueTimer } from "./useQueueTimer";
import { MODE_LABELS } from "../shared/mode-labels";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

const TIME_CONTROL_LABEL: Record<Mode, string> = {
  Bullet: "1 minute",
  Blitz: "3 minutes",
  Rapid: "10 minutes",
  Classical: "30 minutes",
};

export function SearchingPhase(): JSX.Element | null {
  const mode = useMatchmakingStore((s) => s.mode);
  const leaveQueue = useMatchmakingStore((s) => s.leaveQueue);
  const elapsed = useQueueTimer();

  const user = useAuthStore((s) => s.user);

  if (mode === null) return null;

  const ratingEntry = user?.ratings?.find((r) => r.mode === mode);
  const displayRating = ratingEntry?.rating ?? 1500;

  return (
    <div className="max-w-2xl mx-auto px-3 py-6 sm:px-4 sm:py-10 flex flex-col gap-6">
      <h1 className="text-3xl font-semibold text-text-primary">Looking for an opponent...</h1>

      <Card variant="glass" padding="lg">
        <p className="text-text-secondary text-sm text-center">
          {MODE_LABELS[mode]}, {TIME_CONTROL_LABEL[mode]}
        </p>
      </Card>

      <Card variant="glass" padding="md">
        <p className="text-text-secondary text-sm text-center">
          Your rating:{" "}
          <span className="text-text-primary font-semibold">{displayRating}</span>
        </p>
      </Card>

      <Card variant="glass" padding="md">
        <p className="text-text-secondary text-sm text-center">
          in queue:{" "}
          <span className="text-text-primary font-semibold font-mono">{elapsed}</span>
        </p>
      </Card>

      <Card variant="glass" padding="md">
        <p className="text-text-secondary text-sm text-center">
          Looking for a player of similar rating. If no one is found within 10 seconds, the range widens.
        </p>
      </Card>

      <div className="flex justify-center">
        <Button variant="secondary" size="lg" onClick={leaveQueue}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
