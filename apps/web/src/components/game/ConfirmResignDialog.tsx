import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/Dialog";
import { Button } from "../ui/Button";
import type { GameColor } from "../../features/shared/game-view-model";

interface ConfirmResignDialogProps {
  open: boolean;
  activeColor: GameColor;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmResignDialog({ open, activeColor, onConfirm, onCancel }: ConfirmResignDialogProps): JSX.Element {
  const { t } = useTranslation("game");
  const side = activeColor === "white" ? "white" : "black";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogTitle>{t("actions.confirmResign", { side })}</DialogTitle>
        <DialogDescription className="sr-only">{t("drawOffer.description")}</DialogDescription>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={onCancel}>{t("actions.cancel")}</Button>
          <Button variant="danger" onClick={onConfirm}>{t("actions.confirm")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
