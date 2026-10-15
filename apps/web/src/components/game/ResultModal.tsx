import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import type { Winner } from "../../features/game/useGameStore";
import type { AnyGameEndReason } from "../../features/shared/game-view-model";

const TITLE: Partial<Record<AnyGameEndReason, (winner: Winner) => string>> = {
  checkmate: (w) =>
    w === "white" ? "White wins. Checkmate." : "Black wins. Checkmate.",
  stalemate: () => "Draw. Stalemate.",
  insufficient_material: () => "Draw. Insufficient material.",
  threefold_repetition: () => "Draw. Threefold repetition.",
  fifty_move_rule: () => "Draw. Fifty-move rule.",
  flag_fall: (w) =>
    w === "black"
      ? "White lost. Flag."
      : "Black lost. Flag.",
  flag_fall_insufficient_material: () =>
    "Draw. Opponent has insufficient material.",
  resignation: (w) =>
    w === "white"
      ? "Black resigned. White wins."
      : "White resigned. Black wins.",
  draw_agreement: () => "Draw. By agreement.",
};

interface ResultModalProps {
  result: { winner: Winner; reason: AnyGameEndReason } | null;
  resultModalDismissed: boolean;
  onNewGame: () => void;
  onDismiss: () => void;
}

export function ResultModal({ result, resultModalDismissed, onNewGame, onDismiss }: ResultModalProps): JSX.Element {
  const isOpen = result !== null && !resultModalDismissed;
  const title = result != null ? (TITLE[result.reason]?.(result.winner) ?? result.reason) : "";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Game result screen
        </DialogDescription>
        <div className="flex gap-3 mt-6">
          <Button variant="primary" size="lg" onClick={onNewGame}>
            New game
          </Button>
          <Button variant="secondary" size="lg" onClick={onDismiss}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
