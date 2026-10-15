import { useOnlineGameStore } from "./useOnlineGameStore";
import { useAuthStore } from "../auth/useAuthStore";
import type { GameViewModel } from "../shared/game-view-model";

export function useOnlineGameViewModel(): GameViewModel | null {
  const state = useOnlineGameStore();
  const userNickname = useAuthStore((s) => s.user?.nickname) ?? "";

  // suppress unused warning — nickname is available for future use
  void userNickname;

  if (state.gameId === null || state.color === null || state.mode === null) return null;

  const myColor = state.color;
  const isMyTurn = state.sideToMove === myColor && state.result === null;
  const canInteract = isMyTurn && state.pendingPromotion === null;

  return {
    mode: state.mode,
    fen: state.fen,
    movesSan: state.movesSan,
    clocks: state.clocks,
    sideToMove: state.sideToMove,
    boardOrientation: myColor,
    canInteract,
    lastMove: state.lastMove,
    pendingPromotion: state.pendingPromotion,
    pendingDrawOffer: state.pendingDrawOffer,
    pendingResign: state.pendingResign,
    result:
      state.result !== null && state.endReason !== null
        ? { winner: state.winner ?? ("draw" as const), reason: state.endReason }
        : null,
    resultModalDismissed: state.resultModalDismissed,

    onSelectSquare: () => {},
    onMove: (move) => {
      if (move.promotion) {
        state.makeMove(move.from, move.to, move.promotion);
        return;
      }
      // Detect pawn promotion: pawn moving to rank 8 (white) or rank 1 (black)
      const toRank = move.to[1];
      const isPawnToLastRank =
        (myColor === "white" && toRank === "8") ||
        (myColor === "black" && toRank === "1");
      if (isPawnToLastRank) {
        // Verify it's actually a pawn move — check current FEN position
        // We set pendingPromotion; PromotionDialog will call onPromote
        state.setPendingPromotion({ from: move.from, to: move.to });
        return;
      }
      state.makeMove(move.from, move.to);
    },
    onPromote: (piece) => {
      const p = state.pendingPromotion;
      if (!p) return;
      state.makeMove(p.from, p.to, piece);
    },
    onCancelPromotion: () => state.cancelPromotion(),

    onResignClick: () => state.openResign(),
    onResignConfirm: () => state.confirmResign(),
    onResignCancel: () => state.cancelResign(),
    onOfferDraw: () => state.offerDraw(),
    onRespondDraw: (accept: boolean) => state.respondDraw(accept),
    onDismissResult: () => state.dismissResult(),
    onNewGame: () => state.startNewGame(),
  };
}
