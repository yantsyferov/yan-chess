import { useNavigate } from "react-router-dom";
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

// Map online GameEndReason to an English reason suffix
function reasonSuffix(reason: AnyGameEndReason, winner: Winner): string {
  switch (reason) {
    case "checkmate":
      return "Checkmate.";
    case "resignation":
      // winner is the player who received the resignation; loser is the other side
      return winner === "white" ? "Black resigned." : "White resigned.";
    case "flag":
    case "flag_fall":
      return "Flag.";
    case "flag_vs_insufficient_material":
    case "flag_fall_insufficient_material":
      return "Opponent has insufficient material.";
    case "stalemate":
      return "Stalemate.";
    case "insufficient_material":
      return "Insufficient material.";
    case "threefold_repetition":
      return "Threefold repetition.";
    case "fifty_move":
    case "fifty_move_rule":
      return "Fifty-move rule.";
    case "agreement":
    case "draw_agreement":
      return "By agreement.";
    default: {
      const _exhaustive: never = reason;
      return String(_exhaustive);
    }
  }
}

function perspectiveVerb(winner: Winner, myColor: GameColor): string {
  if (winner === "draw") return "Draw";
  if (winner === myColor) return "You won";
  return "You lost";
}

function formatDelta(delta: number): string {
  if (delta >= 0) return `+${delta}`;
  // Use Unicode minus sign (U+2212)
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
  const navigate = useNavigate();
  const isOpen = result !== null && !resultModalDismissed;

  const title =
    result !== null
      ? `${perspectiveVerb(result.winner, myColor)}. ${reasonSuffix(result.reason, result.winner)}`
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
                Rating: {ratingBefore} → {ratingAfter} ({formatDelta(ratingDelta!)})
              </p>
            )}
          </div>
        </DialogDescription>
        <div className="mt-6 space-y-2">
          {pendingRematch?.from === "opponent" && (
            <p className="text-sm text-text-secondary">Opponent offers a rematch</p>
          )}
          {rematchExpiredToast && (
            <p className="text-sm text-text-secondary">Opponent didn't respond</p>
          )}
          <div className="flex gap-3">
            {pendingRematch?.from === "me" ? (
              <Button variant="secondary" size="lg" disabled>
                Waiting for rematch…
              </Button>
            ) : pendingRematch?.from === "opponent" ? (
              <Button variant="secondary" size="lg" onClick={() => onRespondRematch(true)}>
                Accept rematch
              </Button>
            ) : (
              <Button variant="secondary" size="lg" onClick={onOfferRematch}>
                Rematch
              </Button>
            )}
            <Button variant="primary" size="lg" onClick={handleNewGame}>
              New game
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                if (pendingRematch?.from === "opponent") {
                  onRespondRematch(false);
                }
                onDismiss();
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
