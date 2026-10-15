import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/Dialog";
import { Button } from "../ui/Button";
import type { GameColor } from "../../features/shared/game-view-model";

interface DrawOfferDialogProps {
  pending: { from: GameColor } | null;
  onRespond: (accept: boolean) => void;
}

export function DrawOfferDialog({ pending, onRespond }: DrawOfferDialogProps): JSX.Element {
  const { t } = useTranslation("game");
  const side = pending?.from === "white" ? "White" : "Black";
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) onRespond(false); }}>
      <DialogContent>
        <DialogTitle>{t("drawOffer.title", { side })}</DialogTitle>
        <DialogDescription className="sr-only">{t("drawOffer.description")}</DialogDescription>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => onRespond(false)}>{t("drawOffer.decline")}</Button>
          <Button variant="primary" onClick={() => onRespond(true)}>{t("drawOffer.accept")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
