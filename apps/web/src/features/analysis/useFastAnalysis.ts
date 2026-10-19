/**
 * useFastAnalysis — React hook that runs a shallow engine pass (depth 10,
 * MultiPV 2) and returns move-quality bucket counts.
 *
 * On mount (when enabled=true) it:
 *   1. Parses the PGN with chess.js to extract positions + played UCIs.
 *   2. Spawns an AnalysisEngine and analyses each position at depth 10.
 *   3. For each half-move, runs classifyMove() using the engine results.
 *   4. Groups the 11 categories into three buckets.
 *
 * On unmount it aborts the engine via AbortController and terminates the
 * worker.
 */

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { AnalysisEngine } from "./analysis-engine";
import { classifyMove, type MoveCategory } from "./classifier";
import { isBookMove } from "./opening-book";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoveQualityBuckets {
  standout: number;
  normal: number;
  mistake: number;
}

export interface UseFastAnalysisOptions {
  pgn: string;
  /** If true, compute buckets separately for White and Black (hotseat mode). */
  perSide?: boolean;
  /** Default true. Set to false to skip the engine run (e.g. dialog not open). */
  enabled?: boolean;
}

export interface UseFastAnalysisResult {
  status: "idle" | "running" | "done" | "error";
  buckets: MoveQualityBuckets | null;
  perSideBuckets?: { white: MoveQualityBuckets; black: MoveQualityBuckets } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STANDOUT: ReadonlySet<MoveCategory> = new Set([
  "Brilliant",
  "Great",
  "Best",
]);
const NORMAL_CATEGORIES: ReadonlySet<MoveCategory> = new Set([
  "Excellent",
  "Good",
  "Book",
  "Forced",
]);
const MISTAKE_CATEGORIES: ReadonlySet<MoveCategory> = new Set([
  "Inaccuracy",
  "Mistake",
  "Blunder",
  "Miss",
]);

function emptyBuckets(): MoveQualityBuckets {
  return { standout: 0, normal: 0, mistake: 0 };
}

function addToCategory(
  buckets: MoveQualityBuckets,
  category: MoveCategory
): void {
  if (STANDOUT.has(category)) buckets.standout++;
  else if (NORMAL_CATEGORIES.has(category)) buckets.normal++;
  else if (MISTAKE_CATEGORIES.has(category)) buckets.mistake++;
}

interface HalfMoveInfo {
  fen: string;
  playedUci: string;
  legalMoveCount: number;
  materialDelta: number;
  color: "w" | "b";
  moveIndex: number;
}

/**
 * Parse a PGN string and extract per-half-move info needed for classification.
 * Returns an array ordered by half-move index (0 = White's first move).
 */
function parsePgn(pgn: string): HalfMoveInfo[] {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return [];
  }

  const history = chess.history({ verbose: true });
  if (history.length === 0) return [];

  const result: HalfMoveInfo[] = [];

  // Replay from the start to capture FEN-before-move + legal move count.
  const replay = new Chess();

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    const legalMoveCount = replay.moves().length;

    // Material delta: positive = gain, negative = sacrifice/capture of own piece.
    // A capture means the player gained `capturedPieceValue`; nothing means 0.
    let materialDelta = 0;
    if (move.captured) {
      // Standard capture: player gains the captured piece's value.
      const pieceValues: Record<string, number> = {
        p: 100, n: 300, b: 300, r: 500, q: 900, k: 0,
      };
      materialDelta = pieceValues[move.captured] ?? 0;
    }
    // A promotion: we approximate by ignoring pawn → piece delta here; the
    // eval will capture the positional gain. Promotions are rare and the
    // material delta is mostly irrelevant for Brilliant detection (which looks
    // for sacrifices, not promotions).

    // UCI: from + to + optional promotion character.
    const playedUci =
      move.from + move.to + (move.promotion ? move.promotion : "");

    // FEN after the move is applied.
    replay.move(move);
    const fenAfter = replay.fen();

    result.push({
      fen: fenAfter,
      playedUci,
      legalMoveCount,
      materialDelta,
      color: move.color,
      moveIndex: i,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFastAnalysis(
  opts: UseFastAnalysisOptions
): UseFastAnalysisResult {
  const { pgn, perSide = false, enabled = true } = opts;

  const [status, setStatus] = useState<UseFastAnalysisResult["status"]>("idle");
  const [buckets, setBuckets] = useState<MoveQualityBuckets | null>(null);
  const [perSideBuckets, setPerSideBuckets] = useState<
    { white: MoveQualityBuckets; black: MoveQualityBuckets } | null
  >(null);

  // Keep references to the engine + abort controller across async work.
  const engineRef = useRef<AnalysisEngine | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !pgn) return;

    const halfMoves = parsePgn(pgn);
    if (halfMoves.length === 0) {
      setStatus("done");
      setBuckets(emptyBuckets());
      if (perSide) {
        setPerSideBuckets({
          white: emptyBuckets(),
          black: emptyBuckets(),
        });
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const engine = new AnalysisEngine();
    engineRef.current = engine;

    setStatus("running");

    (async () => {
      try {
        await engine.init();

        const positions = halfMoves.map((hm) => hm.fen);

        const engineResults = await engine.analyzeGame({
          positions,
          multiPV: 2,
          depth: 10,
          onProgress: () => {},
          signal: controller.signal,
        });

        // Build per-half-move played UCI sequences to check opening book.
        const playedUcis: string[] = halfMoves.map((hm) => hm.playedUci);

        const allBuckets = emptyBuckets();
        const whiteBuckets = emptyBuckets();
        const blackBuckets = emptyBuckets();

        // Track whether the previous opponent half-move was a Blunder.
        // Array indexed by half-move: 0=white move 0, 1=black move 0, ...
        const categories: MoveCategory[] = new Array(halfMoves.length);

        for (let i = 0; i < halfMoves.length; i++) {
          const hm = halfMoves[i];
          const engineResult = engineResults[i];
          if (!engineResult) continue;

          // evalBefore: the engine's top-move evaluation BEFORE this move.
          // For move i, we need the top eval from position i-1 (negated because
          // the side-to-move flipped). For move 0 we approximate evalBefore = 0
          // (starting position is roughly equal).
          let evalBefore = 0;
          if (i > 0 && engineResults[i - 1]?.topMoves.length) {
            // The previous position's top cp was from the opponent's perspective.
            // Negate to get current player's perspective.
            evalBefore = -(engineResults[i - 1].topMoves[0]?.cp ?? 0);
          }

          // evalAfter: the engine's top-move evaluation at THIS position
          // (i.e. after the move was played), from side-to-move perspective
          // of the NEXT player. We negate to get current player's perspective.
          const evalAfter = -(engineResult.topMoves[0]?.cp ?? 0);

          // Opening book check: pass all moves up to and including this one.
          const movesForBook = playedUcis.slice(0, i + 1);
          const bookMove = isBookMove(movesForBook);

          // prevOpponentWasBlunder: the move two indices back (same colour's
          // last move) is not what we want. Actually we want: was the
          // IMMEDIATELY preceding half-move (opponent's) a Blunder?
          const prevOpponentWasBlunder =
            i > 0 ? categories[i - 1] === "Blunder" : false;

          const category = classifyMove({
            legalMoveCount: hm.legalMoveCount,
            isBookMove: bookMove,
            topMoves: engineResult.topMoves,
            evalBefore,
            evalAfter,
            playedUci: hm.playedUci,
            materialDelta: hm.materialDelta,
            prevOpponentWasBlunder,
          });

          categories[i] = category;
          addToCategory(allBuckets, category);

          if (perSide) {
            if (hm.color === "w") {
              addToCategory(whiteBuckets, category);
            } else {
              addToCategory(blackBuckets, category);
            }
          }
        }

        setBuckets(allBuckets);
        if (perSide) {
          setPerSideBuckets({ white: whiteBuckets, black: blackBuckets });
        }
        setStatus("done");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Clean abort on unmount — no state update needed.
          return;
        }
        console.error("useFastAnalysis: engine error", err);
        setStatus("error");
      }
    })();

    return () => {
      controller.abort();
      engineRef.current?.terminate();
      engineRef.current = null;
      abortRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pgn, enabled]);

  return { status, buckets, perSideBuckets };
}
