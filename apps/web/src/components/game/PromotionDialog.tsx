import { Dialog, DialogContent, DialogTitle } from "../ui/Dialog";
import type { PendingPromotion } from "../../features/shared/game-view-model";

type PromotionPiece = "q" | "r" | "b" | "n";

interface PieceOption {
  piece: PromotionPiece;
  whiteGlyph: string;
  blackGlyph: string;
  label: string;
}

const PIECE_OPTIONS: PieceOption[] = [
  { piece: "q", whiteGlyph: "♕", blackGlyph: "♛", label: "Queen" },
  { piece: "r", whiteGlyph: "♖", blackGlyph: "♜", label: "Rook" },
  { piece: "b", whiteGlyph: "♗", blackGlyph: "♝", label: "Bishop" },
  { piece: "n", whiteGlyph: "♘", blackGlyph: "♞", label: "Knight" },
];

interface PromotionDialogProps {
  pending: PendingPromotion | null;
  promotingColor: "w" | "b";
  onPromote: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

export function PromotionDialog({ pending, promotingColor, onPromote, onCancel }: PromotionDialogProps): JSX.Element {
  const isOpen = pending !== null;

  function handleOpenChange(open: boolean): void {
    if (!open) onCancel();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogTitle className="text-center mb-4">Choose a piece</DialogTitle>
        <div className="flex gap-3 justify-center">
          {PIECE_OPTIONS.map(({ piece, whiteGlyph, blackGlyph, label }, index) => (
            <button
              key={piece}
              aria-label={label}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={index === 0}
              onClick={() => onPromote(piece)}
              className="h-20 w-20 text-5xl flex items-center justify-center rounded-lg border border-border-subtle bg-surface-overlay hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors"
            >
              {promotingColor === "w" ? whiteGlyph : blackGlyph}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
