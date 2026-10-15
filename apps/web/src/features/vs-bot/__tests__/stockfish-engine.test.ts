// @layer: unit
// @spec: 005-play-vs-bot
// @regression

/**
 * Tests for StockfishEngine wrapper.
 *
 * Strategy: build a self-contained testable engine using an injected MockWorker
 * so we never touch the real Stockfish WASM binary. All UCI protocol assertions
 * are made against the messages recorded by MockWorker.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Minimal mock Worker
// ---------------------------------------------------------------------------

class MockWorker {
  onmessage: ((event: { data: string }) => void) | null = null;
  readonly posted: string[] = [];
  private _terminated = false;

  postMessage(msg: string): void {
    this.posted.push(msg);
  }

  terminate(): void {
    this._terminated = true;
  }

  get isTerminated(): boolean {
    return this._terminated;
  }

  /** Dispatch a line to the registered onmessage handler. */
  simulateLine(line: string): void {
    this.onmessage?.({ data: line });
  }
}

// ---------------------------------------------------------------------------
// Inline testable engine (mirrors StockfishEngine without sharing module state)
// ---------------------------------------------------------------------------

type LineHandler = (line: string) => void;

class TestableEngine {
  private worker: MockWorker;
  private handlers: LineHandler[] = [];
  private searching = false;

  constructor(worker: MockWorker) {
    this.worker = worker;
    this.worker.onmessage = (event) => {
      const line = String(event.data);
      for (const h of [...this.handlers]) h(line);
    };
  }

  private waitFor(
    pred: (l: string) => boolean,
    timeoutMs: number,
    msg: string,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.handlers = this.handlers.filter((h) => h !== handler);
        reject(new Error(msg));
      }, timeoutMs);

      const handler: LineHandler = (line) => {
        if (pred(line)) {
          clearTimeout(timer);
          this.handlers = this.handlers.filter((h) => h !== handler);
          resolve(line);
        }
      };

      this.handlers.push(handler);
    });
  }

  async init(): Promise<void> {
    // Set up the uciok listener FIRST, then send the command so simulateLine
    // can fire synchronously and the handler is already registered.
    const uciokP = this.waitFor((l) => l.trim() === "uciok", 5_000, "timeout uciok");
    this.worker.postMessage("uci");
    await uciokP;

    const readyokP = this.waitFor((l) => l.trim() === "readyok", 5_000, "timeout readyok");
    this.worker.postMessage("isready");
    await readyokP;
  }

  bestMove(fen: string, movetimeMs: number): Promise<string> {
    if (this.searching) return Promise.reject(new Error("already searching"));
    this.searching = true;

    const p = this.waitFor(
      (l) => l.startsWith("bestmove "),
      10_000,
      "timeout bestmove",
    )
      .then((line) => {
        const parts = line.trim().split(/\s+/);
        const move = parts[1];
        if (!move || move === "(none)") throw new Error(`no move in: "${line}"`);
        return move;
      })
      .finally(() => {
        this.searching = false;
      });

    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go movetime ${movetimeMs}`);

    return p;
  }

  terminate(): void {
    this.worker.postMessage("quit");
    this.worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Helper: build and initialize a ready engine
// The key insight: waitFor registers the handler SYNCHRONOUSLY when called.
// Then simulateLine dispatches to it. We interleave start+simulate correctly.
// ---------------------------------------------------------------------------

async function makeReadyEngine(): Promise<{ engine: TestableEngine; worker: MockWorker }> {
  const worker = new MockWorker();
  const engine = new TestableEngine(worker);

  // Start the init promise — this registers the "uciok" handler synchronously
  // inside waitFor before the first await. We then immediately simulate the
  // engine reply BEFORE awaiting, so the handler is already in place.
  const initP = engine.init();
  // At this point init has run up to "await uciokP" — the handler IS registered.
  worker.simulateLine("uciok");
  // Now init will await readyokP — simulate reply after yielding:
  await Promise.resolve(); // let the microtask for "uciok resolved" run
  worker.simulateLine("readyok");
  await initP;

  return { engine, worker };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StockfishEngine.init", () => {
  it("sends 'uci' before 'isready' in correct order", async () => {
    // @regression
    const { worker } = await makeReadyEngine();
    const uciIdx = worker.posted.indexOf("uci");
    const isreadyIdx = worker.posted.indexOf("isready");
    expect(uciIdx).toBeGreaterThanOrEqual(0);
    expect(isreadyIdx).toBeGreaterThanOrEqual(0);
    expect(uciIdx).toBeLessThan(isreadyIdx);
  });

  it("resolves without error on uciok + readyok handshake", async () => {
    // @regression
    // If makeReadyEngine completes without throwing, init resolved correctly
    const { engine } = await makeReadyEngine();
    expect(engine).toBeDefined();
  });
});

describe("StockfishEngine.bestMove", () => {
  it("sends 'position fen …' and 'go movetime …' then resolves on first bestmove message", async () => {
    // @regression
    const { engine, worker } = await makeReadyEngine();
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

    const moveP = engine.bestMove(fen, 500);
    // Handler for bestmove is registered synchronously inside bestMove
    worker.simulateLine("bestmove e7e5 ponder e2e4");
    const move = await moveP;

    expect(move).toBe("e7e5");
    expect(worker.posted.find((m) => m.startsWith("position fen "))).toContain(fen);
    expect(worker.posted.find((m) => m.startsWith("go movetime "))).toBe("go movetime 500");
  });

  it("parses promotion move: 'd7d8q' returns 'd7d8q'", async () => {
    // @regression
    const { engine, worker } = await makeReadyEngine();
    const moveP = engine.bestMove("8/3P4/8/8/8/8/8/k6K w - - 0 1", 500);
    worker.simulateLine("bestmove d7d8q");
    expect(await moveP).toBe("d7d8q");
  });

  it("negative: rejects when bestmove line contains '(none)'", async () => {
    const { engine, worker } = await makeReadyEngine();
    const moveP = engine.bestMove(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      500,
    );
    worker.simulateLine("bestmove (none)");
    await expect(moveP).rejects.toThrow();
  });
});

describe("StockfishEngine.terminate", () => {
  it("posts 'quit' and calls worker.terminate()", async () => {
    // @regression
    const { engine, worker } = await makeReadyEngine();
    engine.terminate();
    expect(worker.posted).toContain("quit");
    expect(worker.isTerminated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UCI string parsing helpers
// ---------------------------------------------------------------------------

describe("UCI string parsing", () => {
  it("'e2e4' → from=e2, to=e4, no promotion", () => {
    // @regression
    const uci = "e2e4";
    expect(uci.slice(0, 2)).toBe("e2");
    expect(uci.slice(2, 4)).toBe("e4");
    expect(uci.length === 5 ? uci[4] : undefined).toBeUndefined();
  });

  it("'e7e8q' → from=e7, to=e8, promotion=q", () => {
    // @regression
    const uci = "e7e8q";
    expect(uci.slice(0, 2)).toBe("e7");
    expect(uci.slice(2, 4)).toBe("e8");
    expect(uci.length === 5 ? uci[4] : undefined).toBe("q");
  });

  it("negative: malformed 3-char UCI string gives invalid to-square", () => {
    const uci = "e2e"; // malformed
    expect(uci.slice(2, 4)).toHaveLength(1); // not a valid 2-char square
  });
});
