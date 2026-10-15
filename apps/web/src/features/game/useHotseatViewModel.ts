import { useGameStore } from "./useGameStore";
import { isPawnPromotion } from "./chess-engine";
import type { GameViewModel, MoveInput } from "../shared/game-view-model";

export function useHotseatViewModel(): GameViewModel {
  const state = useGameStore();

  const {
    chess,
    fen,
    mode,
    phase,
    clock,
    lastMove,
    pendingPromotion,
    pendingDrawOffer,
    pendingResign,
    result,
    resultModalDismissed,
    makeMove,
    selectSquare,
    openPromotion,
    cancelPromotion,
    openResignConfirm,
    cancelResignConfirm,
    resign,
    offerDraw,
    respondToDrawOffer,
    dismissResult,
    reset,
  } = state;

  const canInteract = phase === "playing" && pendingPromotion === null && pendingResign === null;
  const sideToMove: "white" | "black" = chess.turn() === "w" ? "white" : "black";

  function onMove(move: MoveInput): void {
    const { from, to, promotion } = move;
    if (promotion) {
      makeMove(from as import("chess.js").Square, to as import("chess.js").Square, promotion);
      return;
    }
    if (isPawnPromotion(chess, from as import("chess.js").Square, to as import("chess.js").Square)) {
      const legalMoves = chess.moves({ square: from as import("chess.js").Square, verbose: true });
      const hasLegalPromotion = legalMoves.some((m) => m.to === to && m.promotion);
      if (hasLegalPromotion) {
        openPromotion({ from: from as import("chess.js").Square, to: to as import("chess.js").Square });
      }
      return;
    }
    makeMove(from as import("chess.js").Square, to as import("chess.js").Square);
  }

  return {
    mode,
    fen,
    movesSan: chess.history(),
    clocks: { whiteMs: clock.white, blackMs: clock.black },
    sideToMove,
    boardOrientation: "white",
    canInteract,
    lastMove: lastMove ?? null,
    pendingPromotion: pendingPromotion ?? null,
    pendingDrawOffer: pendingDrawOffer !== null ? { from: pendingDrawOffer } : null,
    pendingResign: pendingResign !== null,
    result: result ?? null,
    resultModalDismissed,

    onSelectSquare: (sq) => selectSquare(sq as import("chess.js").Square),
    onMove,
    onPromote: (piece) => {
      if (pendingPromotion) {
        makeMove(
          pendingPromotion.from as import("chess.js").Square,
          pendingPromotion.to as import("chess.js").Square,
          piece,
        );
      }
    },
    onCancelPromotion: cancelPromotion,
    onResignClick: openResignConfirm,
    onResignConfirm: resign,
    onResignCancel: cancelResignConfirm,
    onOfferDraw: offerDraw,
    onRespondDraw: respondToDrawOffer,
    onDismissResult: dismissResult,
    onNewGame: reset,
  };
}
