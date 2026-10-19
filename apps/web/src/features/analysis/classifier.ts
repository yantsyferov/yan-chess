/**
 * Move classifier — pure function, no engine calls.
 *
 * Precedence order (first match wins):
 *   Forced → Book → Brilliant → Great → Miss → Best → Excellent → Good →
 *   Inaccuracy → Mistake → Blunder
 *
 * Thresholds and Brilliant definition are documented as CLASSIFIER_VERSION = 1
 * approximations. Bump the version constant when the logic changes to
 * invalidate cached deep-pass results.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const CLASSIFIER_VERSION = 1;

export type MoveCategory =
  | "Brilliant"
  | "Great"
  | "Best"
  | "Excellent"
  | "Good"
  | "Book"
  | "Forced"
  | "Inaccuracy"
  | "Mistake"
  | "Blunder"
  | "Miss";

export interface ClassifierContext {
  /** Number of legal moves available to the side to move before this move. */
  legalMoveCount: number;
  /** True if isBookMove(movesSoFar) returned true for this position. */
  isBookMove: boolean;
  /**
   * Top engine moves at the position before this move was played.
   * Sorted by score descending (topMoves[0] is the best move).
   * Length equals the multiPV setting used (typically 2 for fast, 3 for deep).
   */
  topMoves: { uci: string; cp: number; mate: number | null }[];
  /** Engine evaluation of the top move before this move (cp, from side-to-move perspective). */
  evalBefore: number;
  /** Engine evaluation after this move was played (cp, from side-to-move perspective, i.e. negated relative to before). */
  evalAfter: number;
  /** The UCI string of the move that was actually played. */
  playedUci: string;
  /**
   * Material change from this move, in centipawns from the player's perspective.
   * Negative means the player gave up material (capture of their piece, or sacrifice).
   * Positive means the player gained material.
   */
  materialDelta: number;
  /**
   * True if the opponent's previous half-move was classified as a Blunder,
   * i.e. the player had a winning advantage handed to them.
   */
  prevOpponentWasBlunder: boolean;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Standard material values in centipawns. King is 0 (never captured in practice). */
export function materialValue(piece: string): number {
  switch (piece.toLowerCase()) {
    case "p":
      return 100;
    case "n":
      return 300;
    case "b":
      return 300;
    case "r":
      return 500;
    case "q":
      return 900;
    case "k":
      return 0;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/**
 * Classify a single half-move given its evaluation context.
 *
 * Returns the first matching category in precedence order:
 * Forced → Book → Brilliant → Great → Miss → Best → Excellent → Good →
 * Inaccuracy → Mistake → Blunder
 */
export function classifyMove(ctx: ClassifierContext): MoveCategory {
  const {
    legalMoveCount,
    isBookMove: isBook,
    topMoves,
    evalBefore,
    evalAfter,
    playedUci,
    materialDelta,
    prevOpponentWasBlunder,
  } = ctx;

  // cpLoss: positive = the played move lost centipawns vs the best move.
  // evalBefore is from side-to-move perspective; evalAfter is already from
  // side-to-move perspective of the NEXT position (opponent's turn), so it
  // must be negated to get the evaluation from the current player's perspective
  // after the move.
  //
  // Convention used throughout: cpLoss = evalBefore - evalAfter
  // where evalAfter has already been flipped by the caller (derivation in
  // analysis-engine.ts: evalAfter = -nextPosition.topMoves[0].cp).
  const cpLoss = evalBefore - evalAfter;

  // 1. Forced — only one legal move, regardless of evaluation.
  if (legalMoveCount === 1) return "Forced";

  // 2. Book — position is in the ECO opening database.
  if (isBook) return "Book";

  // 3. Brilliant — MVP proxy: the player gave up ≥300 cp of material
  //    (at least a minor piece) AND the resulting position is still
  //    advantageous (evalAfter ≥ 150) AND the cp loss is ≤ 50.
  if (materialDelta <= -300 && evalAfter >= 150 && cpLoss <= 50) {
    return "Brilliant";
  }

  // 4. Great — the only strong move: the gap between topMoves[0] and
  //    topMoves[1] is ≥ 150 cp AND the player chose topMoves[0].
  if (
    topMoves.length >= 2 &&
    topMoves[0].cp - topMoves[1].cp >= 150 &&
    playedUci === topMoves[0].uci
  ) {
    return "Great";
  }

  // 5. Miss — the opponent just blundered (handed the player a big advantage)
  //    and the player failed to maintain it.
  //    Condition: prevOpponentWasBlunder AND evalAfter < evalBefore - 299
  //    (the player threw away ≥300 cp of the windfall advantage).
  if (prevOpponentWasBlunder && evalAfter < evalBefore - 299) {
    return "Miss";
  }

  // 6. Best — the player chose the engine's top move with 0 cp loss.
  if (playedUci === topMoves[0].uci && cpLoss <= 0) {
    return "Best";
  }

  // 7. Excellent — ≤ 10 cp lost.
  if (cpLoss <= 10) return "Excellent";

  // 8. Good — ≤ 50 cp lost.
  if (cpLoss <= 50) return "Good";

  // 9. Inaccuracy — ≤ 150 cp lost.
  if (cpLoss <= 150) return "Inaccuracy";

  // 10. Mistake — ≤ 300 cp lost.
  if (cpLoss <= 300) return "Mistake";

  // 11. Blunder — catch-all (> 300 cp lost).
  return "Blunder";
}
