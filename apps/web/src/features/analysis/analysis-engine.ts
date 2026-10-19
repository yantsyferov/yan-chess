/**
 * WebWorker wrapper around /stockfish-19-lite-single.js for sequential
 * game analysis with Multi-PV support and AbortSignal cancellation.
 *
 * This is intentionally a separate file from features/vs-bot/stockfish-engine.ts.
 * The vs-bot engine is a singleton purpose-built for single bestMove(fen, movetime)
 * calls; this wrapper drives sequential multi-position analysis with streaming
 * per-move callbacks.
 *
 * UCI protocol per position:
 *   setoption name MultiPV value <N>      (once at init/reconfigure)
 *   position fen <fen>
 *   go depth <depth>
 *   ... collect "info depth <depth> ... multipv <k> score cp/mate <v> pv <uci> ..." lines ...
 *   bestmove <uci>                        (advance to next position)
 *
 * Mate score normalisation:
 *   score mate +N  →  cp = 10000 - N   (forced mate for side to move)
 *   score mate -N  →  cp = -10000 + N  (forced mate against side to move)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HalfMoveAnalysis {
  halfMoveIndex: number;
  topMoves: { uci: string; cp: number; mate: number | null }[];
  depth: number;
}

export interface AnalyzeGameParams {
  /** One FEN per half-move — the position AFTER the move was applied. */
  positions: string[];
  /** Number of lines to request from Stockfish (2 for fast pass, 3 for deep). */
  multiPV: number;
  /** Search depth (10 for fast, 18 for deep). */
  depth: number;
  /** Called after each half-move completes. */
  onProgress: (index: number, result: HalfMoveAnalysis) => void;
  /** Optional cancellation signal. Sends UCI 'stop' and throws AbortError. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type MessageHandler = (line: string) => void;

/** Normalise a Stockfish mate score to centipawns. */
function mateTocp(mateN: number): number {
  return mateN > 0 ? 10000 - mateN : -10000 - mateN;
}

/**
 * Parse a single "info ... score ... pv ..." line.
 * Returns null if the line does not carry a score + pv.
 */
function parseInfoLine(
  line: string,
  targetDepth: number
): { pvIndex: number; cp: number; mate: number | null; uci: string } | null {
  // Only accept lines at the requested depth.
  const depthMatch = line.match(/\bdepth (\d+)\b/);
  if (!depthMatch || parseInt(depthMatch[1]) !== targetDepth) return null;

  const multipvMatch = line.match(/\bmultipv (\d+)\b/);
  if (!multipvMatch) return null;
  const pvIndex = parseInt(multipvMatch[1]) - 1; // 0-based

  const pvMatch = line.match(/\bpv (\S+)/);
  if (!pvMatch) return null;
  const uci = pvMatch[1];

  let cp: number;
  let mate: number | null = null;

  const cpMatch = line.match(/\bscore cp (-?\d+)\b/);
  const mateMatch = line.match(/\bscore mate (-?\d+)\b/);

  if (mateMatch) {
    mate = parseInt(mateMatch[1]);
    cp = mateTocp(mate);
  } else if (cpMatch) {
    cp = parseInt(cpMatch[1]);
  } else {
    return null;
  }

  return { pvIndex, cp, mate, uci };
}

// ---------------------------------------------------------------------------
// AnalysisEngine
// ---------------------------------------------------------------------------

export class AnalysisEngine {
  private worker: Worker | null = null;
  private messageHandlers: MessageHandler[] = [];
  private currentMultiPV = 0;

  // ------------------------------------------------------------------
  // Low-level worker plumbing
  // ------------------------------------------------------------------

  private send(cmd: string): void {
    if (!this.worker) throw new Error("AnalysisEngine: worker not initialised");
    this.worker.postMessage(cmd);
  }

  private addHandler(h: MessageHandler): void {
    this.messageHandlers.push(h);
  }

  private removeHandler(h: MessageHandler): void {
    this.messageHandlers = this.messageHandlers.filter((x) => x !== h);
  }

  private waitForLine(
    predicate: (line: string) => boolean,
    timeoutMs: number,
    timeoutMsg: string
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const handler: MessageHandler = (line) => {
        if (predicate(line)) {
          if (timer !== null) clearTimeout(timer);
          this.removeHandler(handler);
          resolve(line);
        }
      };

      timer = setTimeout(() => {
        this.removeHandler(handler);
        reject(new Error(timeoutMsg));
      }, timeoutMs);

      this.addHandler(handler);
    });
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /** Create the worker and perform the UCI handshake. */
  async init(): Promise<void> {
    if (this.worker) return;

    this.worker = new Worker("/stockfish-19-lite-single.js");

    this.worker.onmessage = (event: MessageEvent<string>) => {
      const line = typeof event.data === "string" ? event.data : String(event.data);
      for (const handler of [...this.messageHandlers]) {
        handler(line);
      }
    };

    this.worker.onerror = (event) => {
      const errLine = `error: ${event.message ?? "worker error"}`;
      for (const handler of [...this.messageHandlers]) {
        handler(errLine);
      }
    };

    const uciokPromise = this.waitForLine(
      (l) => l.trim() === "uciok",
      10_000,
      "AnalysisEngine: timeout waiting for uciok"
    );
    this.send("uci");
    await uciokPromise;

    const readyokPromise = this.waitForLine(
      (l) => l.trim() === "readyok",
      10_000,
      "AnalysisEngine: timeout waiting for readyok"
    );
    this.send("isready");
    await readyokPromise;
  }

  /**
   * Analyse every position in `params.positions` sequentially and return
   * the full list of per-half-move results.
   *
   * The engine processes one position at a time: issue `go depth <D>`, collect
   * `info` lines at the target depth, wait for `bestmove`, call `onProgress`,
   * then advance.
   *
   * If `params.signal` fires, send `stop`, wait for the trailing `bestmove`,
   * discard the partial half-move, and throw `DOMException("Aborted", "AbortError")`.
   */
  async analyzeGame(params: AnalyzeGameParams): Promise<HalfMoveAnalysis[]> {
    const { positions, multiPV, depth, onProgress, signal } = params;

    if (!this.worker) {
      throw new Error("AnalysisEngine: call init() before analyzeGame()");
    }

    // Configure MultiPV if it changed.
    if (multiPV !== this.currentMultiPV) {
      this.send(`setoption name MultiPV value ${multiPV}`);
      this.currentMultiPV = multiPV;
    }

    const results: HalfMoveAnalysis[] = [];

    for (let i = 0; i < positions.length; i++) {
      // Check for cancellation before starting a new position.
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const fen = positions[i];

      // Accumulator for the best moves at the target depth for this position.
      // Indexed by pvIndex (0-based).
      const topMovesMap = new Map<
        number,
        { uci: string; cp: number; mate: number | null }
      >();

      // Register an info-line listener that accumulates results.
      const infoHandler: MessageHandler = (line) => {
        if (!line.startsWith("info")) return;
        const parsed = parseInfoLine(line, depth);
        if (parsed) {
          topMovesMap.set(parsed.pvIndex, {
            uci: parsed.uci,
            cp: parsed.cp,
            mate: parsed.mate,
          });
        }
      };
      this.addHandler(infoHandler);

      // Issue the position + go command.
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);

      // Handle abort: send stop and wait for trailing bestmove before throwing.
      const abortListener = signal
        ? () => {
            this.send("stop");
          }
        : null;

      if (signal && abortListener) {
        signal.addEventListener("abort", abortListener, { once: true });
      }

      try {
        await this.waitForLine(
          (l) => l.startsWith("bestmove "),
          // Generous timeout: depth 18 on a slow machine can take ~10 s.
          120_000,
          `AnalysisEngine: timeout waiting for bestmove at position ${i}`
        );
      } finally {
        if (signal && abortListener) {
          signal.removeEventListener("abort", abortListener);
        }
        this.removeHandler(infoHandler);
      }

      // If abort fired, discard partial result and throw.
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // Build ordered topMoves array from the accumulated map.
      const topMoves = Array.from(topMovesMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([, v]) => v);

      const result: HalfMoveAnalysis = {
        halfMoveIndex: i,
        topMoves,
        depth,
      };

      results.push(result);
      onProgress(i, result);
    }

    return results;
  }

  /** Terminate the worker. Safe to call multiple times. */
  terminate(): void {
    if (!this.worker) return;
    try {
      this.send("quit");
    } catch {
      // ignore
    }
    this.worker.terminate();
    this.worker = null;
    this.messageHandlers = [];
    this.currentMultiPV = 0;
  }
}
