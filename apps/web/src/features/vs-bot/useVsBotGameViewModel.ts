import type { Square } from "chess.js";
import { useVsBotStore, getVsBotChess } from "./useVsBotStore";
import { isPawnPromotion } from "../game/chess-engine";
import type { GameViewModel, MoveInput } from "../shared/game-view-model";

export interface VsBotGameViewModel extends GameViewModel {
  showDrawOffer: false;
  botThinking: boolean;
}

export function useVsBotGameViewModel(): VsBotGameViewModel | null {
  const state = useVsBotStore();

  const {
    playerColor,
    fen,
    movesSan,
    clocks,
    sideToMove,
    lastMove,
    pendingPromotion,
    pendingResign,
    result,
    resultModalDismissed,
    botThinking,
    setup,
    openPromotion,
    cancelPromotion,
  } = state;

  if (playerColor === null) return null;

  const canInteract =
    sideToMove === playerColor && !botThinking && result === null;

  function onMove(move: MoveInput): void {
    const { from, to, promotion } = move;
    if (promotion) {
      useVsBotStore.getState().playerMove(from, to, promotion);
      return;
    }
    const chess = getVsBotChess();
    if (isPawnPromotion(chess, from as Square, to as Square)) {
      const legalMoves = chess.moves({ square: from as Square, verbose: true });
      const hasLegalPromotion = legalMoves.some((m) => m.to === to && m.promotion);
      if (hasLegalPromotion) {
        openPromotion({ from, to });
      }
      return;
    }
    useVsBotStore.getState().playerMove(from, to);
  }

  function onPromote(piece: "q" | "r" | "b" | "n"): void {
    const p = useVsBotStore.getState().pendingPromotion;
    if (!p) return;
    useVsBotStore.getState().playerMove(p.from, p.to, piece);
  }

  return {
    mode: setup.mode,
    fen,
    movesSan,
    clocks,
    sideToMove,
    boardOrientation: playerColor,
    canInteract,
    lastMove,
    pendingPromotion,
    pendingDrawOffer: null,
    pendingResign,
    result,
    resultModalDismissed,

    showDrawOffer: false,
    botThinking,

    // Task C: no-op — Board handles its own internal selection state
    onSelectSquare: () => {},
    onMove,
    onPromote,
    onCancelPromotion: () => cancelPromotion(),
    onResignClick: () => state.requestResign(),
    onResignConfirm: () => state.resign(),
    onResignCancel: () => state.cancelResign(),
    // Draw is not offered vs bot
    onOfferDraw: () => {},
    onRespondDraw: () => {},
    onDismissResult: () => state.dismissResult(),
    onNewGame: () => state.newGame(),
  };
}
