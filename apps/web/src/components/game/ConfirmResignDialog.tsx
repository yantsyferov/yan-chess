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
  const side = activeColor === "white" ? "white" : "black";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogTitle>Resign as {side}?</DialogTitle>
        <DialogDescription className="sr-only">Confirm resignation</DialogDescription>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Resign</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
