import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/Dialog";
import { Button } from "../ui/Button";
import type { GameColor } from "../../features/shared/game-view-model";

interface DrawOfferDialogProps {
  pending: { from: GameColor } | null;
  onRespond: (accept: boolean) => void;
}

export function DrawOfferDialog({ pending, onRespond }: DrawOfferDialogProps): JSX.Element {
  const side = pending?.from === "white" ? "White" : "Black";
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) onRespond(false); }}>
      <DialogContent>
        <DialogTitle>{side} offers a draw.</DialogTitle>
        <DialogDescription className="sr-only">Draw offer</DialogDescription>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => onRespond(false)}>Decline</Button>
          <Button variant="primary" onClick={() => onRespond(true)}>Accept</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
