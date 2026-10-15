import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "../ui/Dialog";
import type { PendingPromotion } from "../../features/shared/game-view-model";

type PromotionPiece = "q" | "r" | "b" | "n";

interface PieceOption {
  piece: PromotionPiece;
  whiteGlyph: string;
  blackGlyph: string;
  labelKey: string;
}

const PIECE_OPTIONS: PieceOption[] = [
  { piece: "q", whiteGlyph: "♕", blackGlyph: "♛", labelKey: "promotion.queen" },
  { piece: "r", whiteGlyph: "♖", blackGlyph: "♜", labelKey: "promotion.rook" },
  { piece: "b", whiteGlyph: "♗", blackGlyph: "♝", labelKey: "promotion.bishop" },
  { piece: "n", whiteGlyph: "♘", blackGlyph: "♞", labelKey: "promotion.knight" },
];

interface PromotionDialogProps {
  pending: PendingPromotion | null;
  promotingColor: "w" | "b";
  onPromote: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

export function PromotionDialog({ pending, promotingColor, onPromote, onCancel }: PromotionDialogProps): JSX.Element {
  const { t } = useTranslation("game");
  const isOpen = pending !== null;

  function handleOpenChange(open: boolean): void {
    if (!open) onCancel();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogTitle className="text-center mb-4">{t("promotion.title")}</DialogTitle>
        <div className="flex gap-3 justify-center">
          {PIECE_OPTIONS.map(({ piece, whiteGlyph, blackGlyph, labelKey }, index) => (
            <button
              key={piece}
              aria-label={t(labelKey)}
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
