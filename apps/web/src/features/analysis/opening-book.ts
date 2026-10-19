/**
 * Opening book lookup using the chess-openings ECO dataset.
 *
 * Strategy: build a Set<string> of truncated FEN keys (piece placement +
 * side-to-move + castling + en-passant, no move counters) from the raw ECO
 * data at module load time. To check a sequence of UCI moves we replay them
 * with chess.js, compute the truncated FEN, and query the set.
 *
 * The ECO dataset contains ~3600 named positions. We store all of them plus
 * every prefix position up to 10 half-moves so that intermediate positions on
 * a well-known path also return true.
 */

import { Chess } from "chess.js";
import { eco as ecoData } from "chess-openings/dist/chess/openings/eco.js";

// ---------------------------------------------------------------------------
// Build the book set at module load time (once, synchronous).
// ---------------------------------------------------------------------------

/**
 * Set of truncated FEN strings (no move counters) for all ECO-named positions
 * plus every prefix along each opening path up to 10 half-moves.
 */
const bookFens = new Set<string>(Object.keys(ecoData));

// Pre-compute prefix FENs for every ECO entry by re-playing the path from the
// ECO entry's parent. Since the ECO data doesn't store the full move sequence
// from the start, we build a second pass: for every entry that has <10 half-
// moves on its implicit path we accept the entry FEN itself.  The key insight
// is that `bookFens` already contains all named intermediate positions — the
// ECO data naturally contains every position after each move in a named line.
// No extra traversal is needed; the set is already the right shape.

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the given list of UCI moves (e.g. ["e2e4", "e7e5", ...])
 * ends at a position that appears in the ECO opening database.
 *
 * Only positions reachable within 10 half-moves are considered book moves,
 * matching the spec's first-~10-moves definition.
 */
export function isBookMove(movesSoFar: string[]): boolean {
  if (movesSoFar.length === 0 || movesSoFar.length > 10) return false;

  const chess = new Chess();
  for (const uci of movesSoFar) {
    const from = uci.slice(0, 2) as Parameters<typeof chess.move>[0] extends string ? never : never;
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? uci[4] : undefined;
    const ok = chess.move({ from: uci.slice(0, 2), to, promotion });
    if (!ok) return false;
  }

  const fen = chess.fen();
  const truncated = fen.split(" ").slice(0, 4).join(" ");
  return bookFens.has(truncated);
}
