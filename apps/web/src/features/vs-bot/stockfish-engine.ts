/**
 * Thin TypeScript wrapper over the Stockfish Web Worker.
 *
 * Vite approach: the stockfish-19-lite-single.js + stockfish-19-lite-single.wasm files
 * are copied to apps/web/public/ (see scripts/copy-stockfish.sh or the manual
 * copy step in the task). Vite serves them as static assets; we load the worker
 * with new Worker("/stockfish-19-lite-single.js") so that the WASM sibling is
 * fetched from the same origin path (/stockfish-19-lite-single.wasm).
 *
 * The single-threaded variant does NOT require SharedArrayBuffer.
 */

import type { BotLevel } from "./bot-levels";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface BotEngine {
  /** Create the worker and perform the UCI handshake. Idempotent. */
  init(): Promise<void>;
  /** Apply UCI strength options for the given level. */
  setLevel(level: BotLevel): Promise<void>;
  /**
   * Ask Stockfish for the best move given a FEN position.
   * @param fen       Full FEN string
   * @param movetimeMs  Time in ms Stockfish is allowed to think
   * @returns UCI move string, e.g. "e2e4" or "e7e8q"
   */
  bestMove(fen: string, movetimeMs: number): Promise<string>;
  /** Cleanly shut down the worker. */
  terminate(): void;
}

// ---------------------------------------------------------------------------
// movetime helper — exported for Slice 3+ callers
// ---------------------------------------------------------------------------

export function movetimeFor(level: BotLevel): number {
  switch (level) {
    case "beginner":
      return 500;
    case "amateur":
      return 500;
    case "clubPlayer":
      return 800;
    case "strong":
      return 2000;
    case "expert":
      return 2500;
  }
}

// ---------------------------------------------------------------------------
// Internal implementation
// ---------------------------------------------------------------------------

type MessageHandler = (line: string) => void;

class StockfishEngine implements BotEngine {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private messageHandlers: MessageHandler[] = [];
  private searching = false;

  // ------------------------------------------------------------------
  // Low-level worker plumbing
  // ------------------------------------------------------------------

  private createWorker(): Worker {
    // The file is served from public/ so the path is absolute from origin.
    return new Worker("/stockfish-19-lite-single.js");
  }

  private send(cmd: string): void {
    if (!this.worker) throw new Error("StockfishEngine: worker not initialised");
    this.worker.postMessage(cmd);
  }

  private addHandler(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  private removeHandler(handler: MessageHandler): void {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
  }

  /**
   * Wait until a line matching `predicate` arrives, then resolve with that line.
   * Rejects after `timeoutMs` with a descriptive error.
   */
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
  // BotEngine.init
  // ------------------------------------------------------------------

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.worker = this.createWorker();

      this.worker.onmessage = (event: MessageEvent<string>) => {
        const line: string =
          typeof event.data === "string" ? event.data : String(event.data);
        for (const handler of this.messageHandlers) {
          handler(line);
        }
      };

      this.worker.onerror = (event) => {
        // Surface errors to any pending handlers as a synthetic line so the
        // timeout on waitForLine eventually fires rather than hanging.
        const errLine = `error: ${event.message ?? "worker error"}`;
        for (const handler of [...this.messageHandlers]) {
          handler(errLine);
        }
      };

      // UCI handshake
      const uciokPromise = this.waitForLine(
        (l) => l.trim() === "uciok",
        10_000,
        "StockfishEngine: timeout waiting for uciok"
      );
      this.send("uci");
      await uciokPromise;

      const readyokPromise = this.waitForLine(
        (l) => l.trim() === "readyok",
        10_000,
        "StockfishEngine: timeout waiting for readyok"
      );
      this.send("isready");
      await readyokPromise;
    })();

    // If init fails, allow a retry by clearing the cached promise.
    this.initPromise.catch(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  // ------------------------------------------------------------------
  // BotEngine.setLevel
  // ------------------------------------------------------------------

  async setLevel(level: BotLevel): Promise<void> {
    switch (level) {
      case "beginner":
        this.send("setoption name UCI_LimitStrength value false");
        this.send("setoption name Skill Level value 0");
        break;
      case "amateur":
        this.send("setoption name UCI_LimitStrength value false");
        this.send("setoption name Skill Level value 5");
        break;
      case "clubPlayer":
        this.send("setoption name UCI_LimitStrength value true");
        this.send("setoption name UCI_Elo value 1500");
        break;
      case "strong":
        this.send("setoption name UCI_LimitStrength value true");
        this.send("setoption name UCI_Elo value 1800");
        break;
      case "expert":
        this.send("setoption name UCI_LimitStrength value true");
        this.send("setoption name UCI_Elo value 2100");
        break;
    }
    // UCI setoption has no acknowledgement — yield a microtask so any
    // synchronous callers see a consistent async boundary.
    await Promise.resolve();
  }

  // ------------------------------------------------------------------
  // BotEngine.bestMove
  // ------------------------------------------------------------------

  bestMove(fen: string, movetimeMs: number): Promise<string> {
    if (this.searching) {
      return Promise.reject(
        new Error(
          "StockfishEngine: bestMove called while a search is already in progress"
        )
      );
    }

    this.searching = true;

    // Generous timeout: movetime * 3 + 2000 ms to allow NNUE weight loading
    // on the first move.
    const timeoutMs = movetimeMs * 3 + 2_000;

    const promise = this.waitForLine(
      (l) => l.startsWith("bestmove "),
      timeoutMs,
      `StockfishEngine: timeout waiting for bestmove (movetime=${movetimeMs}ms)`
    ).then((line) => {
      // "bestmove e2e4" or "bestmove e2e4 ponder e7e5"
      const parts = line.trim().split(/\s+/);
      const move = parts[1];
      if (!move || move === "(none)") {
        throw new Error(`StockfishEngine: engine returned no move — "${line}"`);
      }
      return move;
    });

    promise.finally(() => {
      this.searching = false;
    });

    this.send(`position fen ${fen}`);
    this.send(`go movetime ${movetimeMs}`);

    return promise;
  }

  // ------------------------------------------------------------------
  // BotEngine.terminate
  // ------------------------------------------------------------------

  terminate(): void {
    if (!this.worker) return;
    try {
      this.send("quit");
    } catch {
      // ignore — worker may already be dead
    }
    this.worker.terminate();
    this.worker = null;
    this.initPromise = null;
    this.messageHandlers = [];
    this.searching = false;
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

export const botEngine: BotEngine = new StockfishEngine();
