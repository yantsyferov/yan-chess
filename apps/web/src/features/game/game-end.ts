import type { Chess } from "chess.js";
import type { GameEndReason, Winner } from "./useGameStore";

export function detectGameEnd(
  chess: Chess,
): { winner: Winner; reason: GameEndReason } | null {
  if (chess.isCheckmate()) {
    const winner: Winner = chess.turn() === "w" ? "black" : "white";
    return { winner, reason: "checkmate" };
  }
  if (chess.isStalemate()) {
    return { winner: "draw", reason: "stalemate" };
  }
  if (chess.isInsufficientMaterial()) {
    return { winner: "draw", reason: "insufficient_material" };
  }
  if (chess.isThreefoldRepetition()) {
    return { winner: "draw", reason: "threefold_repetition" };
  }
  if (chess.isDrawByFiftyMoves()) {
    return { winner: "draw", reason: "fifty_move_rule" };
  }
  return null;
}
