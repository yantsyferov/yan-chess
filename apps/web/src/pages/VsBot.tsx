import { useState, useEffect } from "react";
import { useVsBotStore } from "../features/vs-bot/useVsBotStore";
import { VsBotSetup } from "../features/vs-bot/VsBotSetup";
import { VsBotBoard } from "../features/vs-bot/VsBotBoard";
import { botEngine, movetimeFor } from "../features/vs-bot/stockfish-engine";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function VsBot(): JSX.Element {
  const [engineReady, setEngineReady] = useState(false);
  const phase = useVsBotStore((s) => s.phase);
  const botThinking = useVsBotStore((s) => s.botThinking);
  const fen = useVsBotStore((s) => s.fen);
  const result = useVsBotStore((s) => s.result);
  const setupLevel = useVsBotStore((s) => s.setup.level);

  // Effect 1: init / terminate engine (unchanged from Slice 2)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await botEngine.init();
        if (!cancelled) setEngineReady(true);
      } catch (e) {
        console.error("[vs-bot] engine init failed", e);
      }
    })();
    return () => {
      cancelled = true;
      botEngine.terminate();
    };
  }, []);

  // Effect 2: drive engine when it is the bot's turn
  useEffect(() => {
    if (!botThinking || result !== null) return;

    let cancelled = false;

    void (async () => {
      try {
        await botEngine.setLevel(setupLevel);
        if (cancelled) return;

        // Non-reactive read — we only need the length, not a subscription
        const movesLen = useVsBotStore.getState().movesSan.length;
        const baseMovetime = movetimeFor(setupLevel);

        // First bot move cap: load NNUE weights already done but avoid long
        // think on the very first move from start position.
        const movetime =
          movesLen === 0
            ? Math.min(baseMovetime, 1000)
            : baseMovetime;

        let uci: string;
        if (movesLen > 0 && (setupLevel === "beginner" || setupLevel === "amateur")) {
          // Enforce minimum perceived delay for weak levels so the bot doesn't
          // feel instant on trivial positions.
          const [move] = await Promise.all([
            botEngine.bestMove(fen, movetime),
            delay(500),
          ]);
          uci = move;
        } else {
          uci = await botEngine.bestMove(fen, movetime);
        }

        if (cancelled) return;

        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length === 5 ? uci[4] : undefined;

        useVsBotStore.getState().applyBotMove(from, to, promotion);
      } catch (e) {
        if (!cancelled) {
          console.error("[vs-bot] engine bestMove failed", e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [botThinking, fen, setupLevel, result]);

  if (phase === "setup") return <VsBotSetup engineReady={engineReady} />;
  return (
    <div className="max-w-5xl mx-auto px-3 py-6 sm:px-4 sm:py-10">
      <VsBotBoard />
    </div>
  );
}
