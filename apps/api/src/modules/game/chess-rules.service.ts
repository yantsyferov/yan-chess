import { Injectable } from "@nestjs/common";
import { Chess } from "chess.js";

export type MoveApplyResult =
  | {
      ok: true;
      /** New FEN after the move has been applied. */
      fen: string;
      /** Standard Algebraic Notation of the move. */
      san: string;
      lastMove: { from: string; to: string };
      over: {
        reason:
          | "checkmate"
          | "stalemate"
          | "insufficient_material"
          | "threefold_repetition"
          | "fifty_move";
        /** The winning side, or null for draws. */
        winner: "white" | "black" | null;
      } | null;
    }
  | { ok: false; rejection: "illegal_move" | "wrong_turn" | "invalid_promotion" };

@Injectable()
export class ChessRulesService {
  /**
   * Validates `move` against `fen` and, if legal, applies it.
   * Returns the new FEN, SAN, and game-over information when the move ends the game.
   * Returns `ok: false` with a rejection code when the move is illegal or otherwise invalid.
   */
  validateAndApply(
    fen: string,
    move: { from: string; to: string; promotion?: string },
  ): MoveApplyResult {
    const chess = new Chess(fen);

    let result: ReturnType<Chess["move"]>;
    try {
      result = chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    } catch {
      return { ok: false, rejection: "illegal_move" };
    }

    // chess.js v1 throws on illegal moves rather than returning null, but guard both.
    if (!result) {
      return { ok: false, rejection: "illegal_move" };
    }

    // Determine game-over state (evaluated in priority order per spec).
    type OverInfo = {
      reason: "checkmate" | "stalemate" | "insufficient_material" | "threefold_repetition" | "fifty_move";
      winner: "white" | "black" | null;
    };

    let over: OverInfo | null = null;

    if (chess.isCheckmate()) {
      // chess.turn() after the move returns the LOSING side (the side to move next has been mated).
      const losingColor = chess.turn();
      over = {
        reason: "checkmate",
        winner: losingColor === "w" ? "black" : "white",
      };
    } else if (chess.isStalemate()) {
      over = { reason: "stalemate", winner: null };
    } else if (chess.isInsufficientMaterial()) {
      over = { reason: "insufficient_material", winner: null };
    } else if (chess.isThreefoldRepetition()) {
      over = { reason: "threefold_repetition", winner: null };
    } else if (chess.isDrawByFiftyMoves()) {
      over = { reason: "fifty_move", winner: null };
    }

    return {
      ok: true,
      fen: chess.fen(),
      san: result.san,
      lastMove: { from: move.from, to: move.to },
      over,
    };
  }

  /** Returns true when the position loaded from `fen` is checkmate. */
  isCheckmate(fen: string): boolean {
    return new Chess(fen).isCheckmate();
  }

  /** Returns true when the position loaded from `fen` is stalemate. */
  isStalemate(fen: string): boolean {
    return new Chess(fen).isStalemate();
  }

  /**
   * Returns true when the position is drawn by insufficient mating material.
   * Delegates to chess.js `isInsufficientMaterial()`.
   */
  isInsufficientMaterial(fen: string): boolean {
    return new Chess(fen).isInsufficientMaterial();
  }

  /**
   * Returns true when the current position has appeared three times in the game history.
   * Note: chess.js tracks repetition only within the move history of a single `Chess` instance.
   * For full-game detection across reconnects, callers should replay moves from the stored PGN/history.
   */
  isThreefoldRepetition(fen: string): boolean {
    return new Chess(fen).isThreefoldRepetition();
  }

  /**
   * Returns true when the 50-move draw rule has been triggered.
   * Uses chess.js `isDrawByFiftyMoves()` (available in chess.js v1.4+).
   */
  isDrawFiftyMove(fen: string): boolean {
    return new Chess(fen).isDrawByFiftyMoves();
  }

  /**
   * Returns true when the opponent of `flagSide` has sufficient mating material.
   * Used by the flag-detection flow (Slice 6): if the flagging side runs out of time
   * but the opponent cannot deliver checkmate, the game is a draw.
   *
   * The heuristic: scan the FEN board segment for opponent pieces.
   * A single minor piece (bishop or knight) alone with a king is insufficient.
   * Any pawn, rook, queen, or two+ minor pieces means the opponent can (theoretically) mate.
   */
  canOpponentMate(fenAfterFlagSide: string, flagSide: "white" | "black"): boolean {
    const opponentColor = flagSide === "white" ? "b" : "w";
    const chess = new Chess(fenAfterFlagSide);
    const board = chess.board();

    let minorCount = 0;
    let hasPawn = false;
    let hasRookOrQueen = false;

    for (const row of board) {
      for (const square of row) {
        if (!square || square.color !== opponentColor) continue;
        const t = square.type;
        if (t === "p") hasPawn = true;
        if (t === "r" || t === "q") hasRookOrQueen = true;
        if (t === "n" || t === "b") minorCount++;
      }
    }

    // Any pawn, rook, or queen suffices for mate.
    if (hasPawn || hasRookOrQueen) return true;
    // Two or more minor pieces can force mate in most cases.
    if (minorCount >= 2) return true;
    // Lone king or single minor piece cannot mate.
    return false;
  }
}
