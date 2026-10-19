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
import { MoveQualityTiles } from "../../features/analysis/MoveQualityTiles";
import { AnalyzeButton } from "../../features/analysis/AnalyzeButton";
import { useFastAnalysis } from "../../features/analysis/useFastAnalysis";

interface ResultModalProps {
  result: { winner: Winner; reason: AnyGameEndReason } | null;
  resultModalDismissed: boolean;
  pgn: string;
  onNewGame: () => void;
  onDismiss: () => void;
}

export function ResultModal({ result, resultModalDismissed, pgn, onNewGame, onDismiss }: ResultModalProps): JSX.Element {
  const { t } = useTranslation("game");
  const isOpen = result !== null && !resultModalDismissed;

  const { status: analysisStatus, buckets, perSideBuckets } = useFastAnalysis({
    pgn,
    perSide: true,
    enabled: isOpen,
  });

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
        <MoveQualityTiles status={analysisStatus} buckets={buckets} perSideBuckets={perSideBuckets} />
        <div className="flex gap-3 mt-6 flex-wrap">
          <AnalyzeButton
            gameRef={{ kind: "session", source: "hotseat", pgn, playerColor: "white" }}
          />
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
