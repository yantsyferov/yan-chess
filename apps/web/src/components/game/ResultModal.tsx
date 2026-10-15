import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import type { Winner } from "../../features/game/useGameStore";
import type { AnyGameEndReason } from "../../features/shared/game-view-model";

interface ResultModalProps {
  result: { winner: Winner; reason: AnyGameEndReason } | null;
  resultModalDismissed: boolean;
  onNewGame: () => void;
  onDismiss: () => void;
}

export function ResultModal({ result, resultModalDismissed, onNewGame, onDismiss }: ResultModalProps): JSX.Element {
  const { t } = useTranslation("game");
  const isOpen = result !== null && !resultModalDismissed;

  function buildTitle(): string {
    if (result == null) return "";
    const reasonLabel = t(`endReason.${result.reason}`, { defaultValue: result.reason });
    if (result.winner === "white") {
      return `${t("endModal.whiteWins")}. ${reasonLabel}.`;
    }
    if (result.winner === "black") {
      return `${t("endModal.blackWins")}. ${reasonLabel}.`;
    }
    return `${t("endModal.draw")}. ${reasonLabel}.`;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent>
        <DialogTitle>{buildTitle()}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("endModal.descriptionAriaLabel")}
        </DialogDescription>
        <div className="flex gap-3 mt-6">
          <Button variant="primary" size="lg" onClick={onNewGame}>
            {t("endModal.newGame")}
          </Button>
          <Button variant="secondary" size="lg" onClick={onDismiss}>
            {t("endModal.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
