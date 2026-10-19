import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";

interface AnalysisBoardProps {
  fen: string;
  bestMoveUci: string | null;
  boardOrientation: "white" | "black";
}

export function AnalysisBoard({
  fen,
  bestMoveUci,
  boardOrientation,
}: AnalysisBoardProps): JSX.Element {
  const customArrows: [Square, Square, string][] =
    bestMoveUci && bestMoveUci.length >= 4
      ? [
          [
            bestMoveUci.slice(0, 2) as Square,
            bestMoveUci.slice(2, 4) as Square,
            "rgba(0,180,0,0.75)",
          ],
        ]
      : [];

  return (
    <div
      className="w-full max-w-[560px] mx-auto aspect-square"
      data-testid="analysis-board"
    >
      <Chessboard
        position={fen}
        boardOrientation={boardOrientation}
        arePiecesDraggable={false}
        customArrows={customArrows}
        showBoardNotation
      />
    </div>
  );
}
