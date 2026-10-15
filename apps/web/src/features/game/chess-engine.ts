import { Chess } from "chess.js";
import type { Square } from "chess.js";

export function createChess(): Chess {
  return new Chess();
}

export function computeLegalDestinations(chess: Chess, from: Square): Set<Square> {
  const moves = chess.moves({ square: from, verbose: true });
  return new Set(moves.map((m) => m.to as Square));
}

export function isPawnPromotion(chess: Chess, from: Square, to: Square): boolean {
  const piece = chess.get(from);
  if (!piece || piece.type !== "p") return false;
  const toRank = to.charAt(1);
  if (piece.color === "w" && toRank === "8") return true;
  if (piece.color === "b" && toRank === "1") return true;
  return false;
}
