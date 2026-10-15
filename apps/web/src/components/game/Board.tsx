import { Chessboard } from "react-chessboard";
import { useMemo } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { computeLegalDestinations } from "../../features/game/chess-engine";
import type { MoveInput, PendingPromotion } from "../../features/shared/game-view-model";

interface BoardProps {
  fen: string;
  boardOrientation: "white" | "black";
  canInteract: boolean;
  lastMove: { from: string; to: string } | null;
  pendingPromotion: PendingPromotion | null;
  selectedSquare: string | null;
  onMove: (move: MoveInput) => void;
  onSelectSquare: (sq: string) => void;
}

export function Board({
  fen,
  boardOrientation,
  canInteract,
  lastMove,
  selectedSquare,
  onMove,
  onSelectSquare,
}: BoardProps): JSX.Element {
  // Reconstruct a Chess instance from FEN for legal-move computation (pure, no side-effects)
  const chess = useMemo(() => {
    const c = new Chess();
    c.load(fen);
    return c;
  }, [fen]);

  const legalDestinations = useMemo((): Set<Square> => {
    return selectedSquare ? computeLegalDestinations(chess, selectedSquare as Square) : new Set<Square>();
  }, [chess, selectedSquare, fen]);

  const customSquareStyles = useMemo((): Record<string, React.CSSProperties> => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: "rgba(250, 204, 21, 0.35)" };
      styles[lastMove.to] = { background: "rgba(250, 204, 21, 0.35)" };
    }
    if (selectedSquare) {
      styles[selectedSquare] = { background: "rgba(16, 185, 129, 0.45)" };
    }
    for (const sq of legalDestinations) {
      styles[sq] = {
        ...styles[sq],
        backgroundImage:
          "radial-gradient(circle, rgba(16, 185, 129, 0.55) 20%, transparent 24%)",
      };
    }
    return styles;
  }, [lastMove, selectedSquare, legalDestinations]);

  function attemptMove(from: Square, to: Square): boolean {
    if (!canInteract) return false;
    onMove({ from, to });
    // We optimistically return true; the store will silently ignore illegal moves
    return true;
  }

  function handleSquareClick(square: Square): void {
    if (!canInteract) return;
    if (selectedSquare && selectedSquare !== square) {
      const didAttempt = legalDestinations.has(square);
      if (didAttempt) {
        onMove({ from: selectedSquare, to: square });
        return;
      }
      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) onSelectSquare(square);
      else onSelectSquare("");
      return;
    }
    const piece = chess.get(square);
    if (piece && piece.color === chess.turn()) onSelectSquare(square);
    else onSelectSquare("");
  }

  return (
    <div className="w-full max-w-[560px] mx-auto" role="application" aria-label="Chessboard">
      <Chessboard
        position={fen}
        onPieceDrop={(from, to) => attemptMove(from as Square, to as Square)}
        onSquareClick={(sq) => handleSquareClick(sq as Square)}
        customSquareStyles={customSquareStyles}
        arePremovesAllowed={false}
        showBoardNotation
        boardOrientation={boardOrientation}
        onPromotionCheck={() => false}
        onPromotionPieceSelect={() => false}
        showPromotionDialog={false}
      />
    </div>
  );
}
