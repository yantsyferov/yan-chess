import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import type { AnyGameEndReason } from "../shared/game-view-model";
import type { Winner } from "../game/useGameStore";

type PlayerColor = "white" | "black";

interface VsBotResultModalProps {
  result: { winner: Winner; reason: AnyGameEndReason };
  resultModalDismissed: boolean;
  playerColor: PlayerColor;
  onDismiss: () => void;
  onNewGame: () => void;
  onRematch?: () => void;
}

function reasonText(
  reason: AnyGameEndReason,
  winner: Winner,
  playerColor: PlayerColor,
): string {
  switch (reason) {
    case "checkmate":
      return "Checkmate.";
    case "stalemate":
      return "Stalemate.";
    case "insufficient_material":
      return "Insufficient material.";
    case "threefold_repetition":
      return "Threefold repetition.";
    case "fifty_move_rule":
    case "fifty_move":
      return "Fifty-move rule.";
    case "flag_fall":
    case "flag":
      return "Flag.";
    case "flag_fall_insufficient_material":
    case "flag_vs_insufficient_material":
      return "Opponent has insufficient material.";
    case "resignation": {
      // In vs-bot, only the player can resign, so if the player lost → they resigned
      const playerLost = winner !== "draw" && winner !== playerColor;
      return playerLost ? "You resigned." : "Resignation.";
    }
    case "draw_agreement":
    case "agreement":
      return "By agreement.";
    default: {
      const _exhaustive: never = reason;
      return String(_exhaustive);
    }
  }
}

function perspectivePrefix(
  winner: Winner,
  playerColor: PlayerColor,
): string {
  if (winner === "draw") return "Draw.";
  if (winner === playerColor) return "You won.";
  return "You lost.";
}

export function VsBotResultModal({
  result,
  resultModalDismissed,
  playerColor,
  onDismiss,
  onNewGame,
  onRematch,
}: VsBotResultModalProps): JSX.Element {
  const isOpen = !resultModalDismissed;

  const suffix = reasonText(result.reason, result.winner, playerColor);
  // For resignation where the suffix already says "You resigned.", avoid "You lost. You resigned."
  const prefix = perspectivePrefix(result.winner, playerColor);
  const title =
    result.reason === "resignation" && suffix === "You resigned."
      ? `You resigned. Bot wins.`
      : `${prefix} ${suffix}`;

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
          <div className="mt-3 text-sm text-text-secondary" />
        </DialogDescription>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" size="lg" onClick={onRematch ?? (() => {})}>
            Rematch
          </Button>
          <Button variant="primary" size="lg" onClick={onNewGame}>
            New game
          </Button>
          <Button variant="ghost" size="lg" onClick={onDismiss}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
