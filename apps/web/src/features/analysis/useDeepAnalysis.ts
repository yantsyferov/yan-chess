/**
 * useDeepAnalysis — React hook that runs a deep engine pass (depth 18,
 * MultiPV 3) over every half-move in a PGN, streams per-move results,
 * optionally persists them to the backend for online games, and supports
 * cancellation via an AbortController.
 *
 * Session mode (gameId === undefined): analysis runs fully client-side;
 * no backend calls are made.
 *
 * Online mode (gameId set): each analyzed move is batched (every 5) and
 * PUT to the backend. finalize() is called when all moves are done.
 *
 * Cancellation: call cancel() or unmount the component. Already-written
 * moves stay persisted on the server (partial-write semantics per spec §2.3).
 */

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { WriteAnalysisMoveBody } from "@yanchess/shared";
import { AnalysisEngine } from "./analysis-engine";
import { classifyMove, CLASSIFIER_VERSION } from "./classifier";
import type { MoveCategory } from "./classifier";
import { isBookMove } from "./opening-book";
import { writeMove, finalize } from "./analysisService";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type { MoveCategory };

export interface DeepAnalysisProgress {
  done: number;
  total: number;
}

export interface AnalyzedMove {
  moveIndex: number;
  playerColor: "white" | "black";
  san: string;
  playedUci: string;
  category: MoveCategory;
  evaluationCp: number | null;
  mateIn: number | null;
  bestMoveUci: string;
}

export interface UseDeepAnalysisOptions {
  pgn: string;
  /** undefined for session (vs-bot / hotseat) — backend calls are skipped. */
  gameId?: string;
  /** Default true. Set false to defer starting the analysis. */
  enabled?: boolean;
  onProgress?: (progress: DeepAnalysisProgress) => void;
  onMove?: (move: AnalyzedMove) => void;
  onComplete?: (moves: AnalyzedMove[]) => void;
  onError?: (err: Error) => void;
}

export interface UseDeepAnalysisResult {
  status: "idle" | "running" | "done" | "error" | "cancelled";
  progress: DeepAnalysisProgress;
  moves: AnalyzedMove[];
  cancel(): void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface HalfMoveInfo {
  /** FEN after this move was applied (engine input). */
  fen: string;
  playedUci: string;
  san: string;
  legalMoveCount: number;
  materialDelta: number;
  color: "w" | "b";
}

/**
 * Parse PGN and return the FEN for the starting position plus per-half-move
 * info ordered by half-move index.
 */
function parsePgn(pgn: string): {
  startFen: string;
  halfMoves: HalfMoveInfo[];
} {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return { startFen: new Chess().fen(), halfMoves: [] };
  }

  const history = chess.history({ verbose: true });
  if (history.length === 0) {
    return { startFen: new Chess().fen(), halfMoves: [] };
  }

  const replay = new Chess();
  const startFen = replay.fen();
  const halfMoves: HalfMoveInfo[] = [];

  const pieceValues: Record<string, number> = {
    p: 100, n: 300, b: 300, r: 500, q: 900, k: 0,
  };

  for (const move of history) {
    const legalMoveCount = replay.moves().length;

    let materialDelta = 0;
    if (move.captured) {
      materialDelta = pieceValues[move.captured] ?? 0;
    }

    const playedUci = move.from + move.to + (move.promotion ?? "");

    replay.move(move);
    const fen = replay.fen();

    halfMoves.push({
      fen,
      playedUci,
      san: move.san,
      legalMoveCount,
      materialDelta,
      color: move.color,
    });
  }

  return { startFen, halfMoves };
}

const DEEP_DEPTH = 18;
const DEEP_MULTI_PV = 3;
const BATCH_SIZE = 5;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDeepAnalysis(opts: UseDeepAnalysisOptions): UseDeepAnalysisResult {
  const { pgn, gameId, enabled = true, onProgress, onMove, onComplete, onError } = opts;

  const [status, setStatus] = useState<UseDeepAnalysisResult["status"]>("idle");
  const [progress, setProgress] = useState<DeepAnalysisProgress>({ done: 0, total: 0 });
  const [moves, setMoves] = useState<AnalyzedMove[]>([]);

  const engineRef = useRef<AnalysisEngine | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Expose cancel to callers; updated each render via ref.
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled || !pgn) return;

    const { startFen, halfMoves } = parsePgn(pgn);

    if (halfMoves.length === 0) {
      setStatus("done");
      setProgress({ done: 0, total: 0 });
      onComplete?.([]);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const engine = new AnalysisEngine();
    engineRef.current = engine;

    cancelRef.current = () => {
      controller.abort();
      engineRef.current?.terminate();
      engineRef.current = null;
      abortRef.current = null;
      setStatus("cancelled");
    };

    const total = halfMoves.length;
    setStatus("running");
    setProgress({ done: 0, total });
    setMoves([]);

    (async () => {
      try {
        await engine.init();

        // We need position-0 eval (starting FEN) so we can compute evalBefore
        // for the very first half-move. Analyse it separately at the same depth.
        const startResult = await engine.analyzeGame({
          positions: [startFen],
          multiPV: DEEP_MULTI_PV,
          depth: DEEP_DEPTH,
          onProgress: () => {},
          signal: controller.signal,
        });
        const startEval = startResult[0]?.topMoves[0]?.cp ?? 0;

        if (controller.signal.aborted) return;

        // Collect per-half-move FENs for the main pass.
        const positions = halfMoves.map((hm) => hm.fen);
        const playedUcis = halfMoves.map((hm) => hm.playedUci);

        const accumulatedMoves: AnalyzedMove[] = [];
        const categories: MoveCategory[] = [];

        // Buffer for batched backend writes.
        const pendingWrites: { index: number; body: WriteAnalysisMoveBody }[] = [];

        async function flushBatch(): Promise<void> {
          if (!gameId || pendingWrites.length === 0) {
            pendingWrites.length = 0;
            return;
          }
          const batch = pendingWrites.splice(0, pendingWrites.length);
          await Promise.all(
            batch.map(({ index, body }) => writeMove(gameId, index, body))
          );
        }

        // Per-half-move engine results land here via onProgress.
        // We process them synchronously inside the callback to avoid ordering issues.
        let processedCount = 0;
        // Track engine results as they arrive so evalBefore derivation works.
        const engineResultsReceived: Map<
          number,
          { topMoves: { uci: string; cp: number; mate: number | null }[] }
        > = new Map();

        await engine.analyzeGame({
          positions,
          multiPV: DEEP_MULTI_PV,
          depth: DEEP_DEPTH,
          signal: controller.signal,
          onProgress: (index, result) => {
            engineResultsReceived.set(index, result);

            const hm = halfMoves[index];
            if (!hm) return;

            // evalBefore: top eval at the position BEFORE this move, from the
            // current player's perspective.
            //   - Move 0: use the starting-position eval (already from White's PoV).
            //   - Move i>0: negate the previous position's top cp (side flipped).
            let evalBefore: number;
            if (index === 0) {
              evalBefore = startEval;
            } else {
              const prev = engineResultsReceived.get(index - 1);
              evalBefore = -(prev?.topMoves[0]?.cp ?? 0);
            }

            // evalAfter: top eval at the position AFTER this move, from the
            // current player's perspective (negate because side-to-move flipped).
            const evalAfter = -(result.topMoves[0]?.cp ?? 0);

            const movesForBook = playedUcis.slice(0, index + 1);
            const bookMove = isBookMove(movesForBook);

            const prevOpponentWasBlunder =
              index > 0 ? categories[index - 1] === "Blunder" : false;

            const category = classifyMove({
              legalMoveCount: hm.legalMoveCount,
              isBookMove: bookMove,
              topMoves: result.topMoves,
              evalBefore,
              evalAfter,
              playedUci: hm.playedUci,
              materialDelta: hm.materialDelta,
              prevOpponentWasBlunder,
            });

            categories[index] = category;

            const topMove = result.topMoves[0];
            // Centipawn value: null when a forced-mate score is present.
            const evaluationCp: number | null =
              topMove?.mate !== null && topMove?.mate !== undefined ? null : (topMove?.cp ?? null);
            const mateIn: number | null = topMove?.mate ?? null;
            const bestMoveUci = topMove?.uci ?? "";

            const analyzedMove: AnalyzedMove = {
              moveIndex: index,
              playerColor: hm.color === "w" ? "white" : "black",
              san: hm.san,
              playedUci: hm.playedUci,
              category,
              evaluationCp,
              mateIn,
              bestMoveUci,
            };

            accumulatedMoves.push(analyzedMove);
            setMoves((prev) => [...prev, analyzedMove]);

            onMove?.(analyzedMove);
            processedCount++;
            const currentProgress = { done: processedCount, total };
            setProgress(currentProgress);
            onProgress?.(currentProgress);

            // Queue backend write (session mode skips this branch).
            if (gameId) {
              const body: WriteAnalysisMoveBody = {
                playerColor: analyzedMove.playerColor,
                category: analyzedMove.category,
                evaluationCp: analyzedMove.evaluationCp,
                mateIn: analyzedMove.mateIn,
                bestMoveUci: analyzedMove.bestMoveUci,
                classifierVersion: CLASSIFIER_VERSION,
                engineDepth: DEEP_DEPTH,
              };
              pendingWrites.push({ index, body });

              // Flush every BATCH_SIZE moves (fire-and-forget; errors are
              // non-fatal — the deep pass continues regardless).
              if (pendingWrites.length >= BATCH_SIZE) {
                flushBatch().catch((err) =>
                  console.warn("useDeepAnalysis: batch write error", err)
                );
              }
            }
          },
        });

        if (controller.signal.aborted) return;

        // Flush any remaining buffered writes.
        await flushBatch().catch((err) =>
          console.warn("useDeepAnalysis: final batch write error", err)
        );

        // Finalize the analysis record on the backend.
        if (gameId) {
          await finalize(gameId, {
            classifierVersion: CLASSIFIER_VERSION,
            engineDepth: DEEP_DEPTH,
          }).catch((err) =>
            console.warn("useDeepAnalysis: finalize error", err)
          );
        }

        setStatus("done");
        onComplete?.(accumulatedMoves);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Cancelled via signal — status already set by cancelRef or cleanup.
          return;
        }
        console.error("useDeepAnalysis: engine error", err);
        setStatus("error");
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      controller.abort();
      engineRef.current?.terminate();
      engineRef.current = null;
      abortRef.current = null;
      // Status is intentionally not set to "cancelled" here — an unmount during
      // a completed run should not overwrite "done". The component is gone anyway.
    };
    // pgn and enabled are the only reactive inputs; callbacks are intentionally
    // excluded to avoid re-running the engine on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pgn, enabled, gameId]);

  return {
    status,
    progress,
    moves,
    cancel: cancelRef.current,
  };
}
