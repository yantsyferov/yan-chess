import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import type { GameColor } from "@yanchess/shared";
import type { Winner } from "../game/useGameStore";
import type { AnyGameEndReason } from "../shared/game-view-model";

function reasonSuffix(t: (k: string) => string, reason: AnyGameEndReason, winner: Winner): string {
  switch (reason) {
    case "checkmate":
      return t("endReason.checkmate") + ".";
    case "resignation":
      return winner === "white"
        ? t("endReason.resignation") + "."
        : t("endReason.resignation") + ".";
    case "flag":
    case "flag_fall":
      return t("endReason.flag") + ".";
    case "flag_vs_insufficient_material":
    case "flag_fall_insufficient_material":
      return t("endReason.flag_vs_insufficient_material") + ".";
    case "stalemate":
      return t("endReason.stalemate") + ".";
    case "insufficient_material":
      return t("endReason.insufficient_material") + ".";
    case "threefold_repetition":
      return t("endReason.threefold_repetition") + ".";
    case "fifty_move":
    case "fifty_move_rule":
      return t("endReason.fifty_move") + ".";
    case "agreement":
    case "draw_agreement":
      return t("endReason.agreement") + ".";
    default: {
      const _exhaustive: never = reason;
      return String(_exhaustive);
    }
  }
}

function perspectiveVerb(t: (k: string) => string, winner: Winner, myColor: GameColor): string {
  if (winner === "draw") return t("online.result.draw");
  if (winner === myColor) return t("online.result.youWon");
  return t("online.result.youLost");
}

function formatDelta(delta: number): string {
  if (delta >= 0) return `+${delta}`;
  return `−${Math.abs(delta)}`;
}

interface OnlineResultModalProps {
  result: { winner: Winner; reason: AnyGameEndReason } | null;
  resultModalDismissed: boolean;
  myColor: GameColor;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number | null;
  pendingRematch: { from: "me" | "opponent"; expiresAt: number } | null;
  rematchExpiredToast: boolean;
  onDismiss: () => void;
  onNewGame: () => void;
  onOfferRematch: () => void;
  onRespondRematch: (accept: boolean) => void;
}

export function OnlineResultModal({
  result,
  resultModalDismissed,
  myColor,
  ratingBefore,
  ratingAfter,
  ratingDelta,
  pendingRematch,
  rematchExpiredToast,
  onDismiss,
  onNewGame,
  onOfferRematch,
  onRespondRematch,
}: OnlineResultModalProps): JSX.Element {
  const { t } = useTranslation("game");
  const navigate = useNavigate();
  const isOpen = result !== null && !resultModalDismissed;

  const title =
    result !== null
      ? `${perspectiveVerb(t, result.winner, myColor)}. ${reasonSuffix(t, result.reason, result.winner)}`
      : "";

  function handleNewGame(): void {
    onNewGame();
    navigate("/");
  }

  const showRating =
    ratingBefore !== null && ratingAfter !== null && ratingDelta !== null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="mt-3 text-sm text-text-secondary">
            {showRating && (
              <p>
                {t("online.result.rating", {
                  before: ratingBefore,
                  after: ratingAfter,
                  delta: formatDelta(ratingDelta!),
                })}
              </p>
            )}
          </div>
        </DialogDescription>
        <div className="mt-6 space-y-2">
          {pendingRematch?.from === "opponent" && (
            <p className="text-sm text-text-secondary">{t("online.result.opponentOffersRematch")}</p>
          )}
          {rematchExpiredToast && (
            <p className="text-sm text-text-secondary">{t("online.result.opponentDidntRespond")}</p>
          )}
          <div className="flex gap-3">
            {pendingRematch?.from === "me" ? (
              <Button variant="secondary" size="lg" disabled>
                {t("online.result.waitingForRematch")}
              </Button>
            ) : pendingRematch?.from === "opponent" ? (
              <Button variant="secondary" size="lg" onClick={() => onRespondRematch(true)}>
                {t("online.result.acceptRematch")}
              </Button>
            ) : (
              <Button variant="secondary" size="lg" onClick={onOfferRematch}>
                {t("online.result.rematch")}
              </Button>
            )}
            <Button variant="primary" size="lg" onClick={handleNewGame}>
              {t("online.result.newGame")}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                if (pendingRematch?.from === "opponent") {
                  onRespondRematch(false);
                }
                onDismiss();
                navigate("/");
              }}
            >
              {t("online.result.close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
