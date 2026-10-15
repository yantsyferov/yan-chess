import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../features/game/useGameStore";
import { useHotseatViewModel } from "../features/game/useHotseatViewModel";
import { useGameClock } from "../features/game/useGameClock";
import { ModeSelector } from "../components/game/ModeSelector";
import { Board } from "../components/game/Board";
import { PromotionDialog } from "../components/game/PromotionDialog";
import { Clock } from "../components/game/Clock";
import { ResultModal } from "../components/game/ResultModal";
import { GameActions } from "../components/game/GameActions";
import { ConfirmResignDialog } from "../components/game/ConfirmResignDialog";
import { DrawOfferDialog } from "../components/game/DrawOfferDialog";
import { MoveHistory } from "../components/game/MoveHistory";
import { useGameStore as useRawGameStore } from "../features/game/useGameStore";

export default function Game(): JSX.Element {
  const phase = useRawGameStore((s) => s.phase);
  const chess = useRawGameStore((s) => s.chess);
  const vm = useHotseatViewModel();
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  useGameClock();

  // Derive promotingColor from the chess instance (white's turn = "w")
  const promotingColor: "w" | "b" = chess.turn();

  // Derive the current resign side for ConfirmResignDialog
  const { t } = useTranslation("game");
  const pendingResignStore = useRawGameStore((s) => s.pendingResign);
  const resignActiveColor: "white" | "black" = pendingResignStore ?? vm.sideToMove;

  useEffect(() => {
    if (phase !== "playing") return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  // Reset selected square when canInteract changes or on new move
  useEffect(() => {
    if (!vm.canInteract) setSelectedSquare(null);
  }, [vm.canInteract, vm.fen]);

  function handleSelectSquare(sq: string): void {
    setSelectedSquare(sq || null);
    vm.onSelectSquare(sq);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-semibold text-text-primary mb-6 text-center">{t("board.pageTitle")}</h1>
      {phase === "idle" && <ModeSelector />}
      {(phase === "playing" || phase === "ended") && (
        <div className="flex flex-col md:flex-row items-start justify-center gap-6">
          <div className="flex flex-col items-center gap-4">
            <Clock ms={vm.clocks.blackMs} isActive={vm.sideToMove === "black" && phase === "playing"} />
            <Board
              fen={vm.fen}
              boardOrientation={vm.boardOrientation}
              canInteract={vm.canInteract}
              lastMove={vm.lastMove}
              pendingPromotion={vm.pendingPromotion}
              selectedSquare={selectedSquare}
              onMove={(move) => {
                vm.onMove(move);
                setSelectedSquare(null);
              }}
              onSelectSquare={handleSelectSquare}
            />
            <Clock ms={vm.clocks.whiteMs} isActive={vm.sideToMove === "white" && phase === "playing"} />
            <GameActions
              canAct={phase === "playing"}
              onResignClick={vm.onResignClick}
              onOfferDraw={vm.onOfferDraw}
            />
          </div>
          <section className="flex flex-col gap-2 w-full md:w-auto" aria-labelledby="moves-heading">
            <h2 id="moves-heading" className="text-sm text-text-secondary px-1">{t("board.movesHeading")}</h2>
            <MoveHistory movesSan={vm.movesSan} />
          </section>
          {phase === "playing" && (
            <PromotionDialog
              pending={vm.pendingPromotion}
              promotingColor={promotingColor}
              onPromote={vm.onPromote}
              onCancel={vm.onCancelPromotion}
            />
          )}
          {phase === "playing" && (
            <ConfirmResignDialog
              open={vm.pendingResign}
              activeColor={resignActiveColor}
              onConfirm={vm.onResignConfirm}
              onCancel={vm.onResignCancel}
            />
          )}
          {phase === "playing" && (
            <DrawOfferDialog
              pending={vm.pendingDrawOffer}
              onRespond={vm.onRespondDraw}
            />
          )}
        </div>
      )}
      <ResultModal
        result={vm.result}
        resultModalDismissed={vm.resultModalDismissed}
        onNewGame={vm.onNewGame}
        onDismiss={vm.onDismissResult}
      />
    </div>
  );
}
