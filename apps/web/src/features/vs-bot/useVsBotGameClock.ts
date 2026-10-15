import { useEffect, useState } from "react";
import { useVsBotStore } from "./useVsBotStore";

export function useVsBotGameClock(): { whiteMs: number; blackMs: number } {
  const clocks = useVsBotStore((s) => s.clocks);
  const sideToMove = useVsBotStore((s) => s.sideToMove);
  const lastSyncClientMs = useVsBotStore((s) => s.lastSyncClientMs);
  const result = useVsBotStore((s) => s.result);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (result !== null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 100);
    return () => window.clearInterval(id);
  }, [result]);

  const elapsed = Date.now() - lastSyncClientMs;

  // Reading tick ensures the setState call triggers a re-render each interval.
  void tick;

  return {
    whiteMs: sideToMove === "white" ? Math.max(0, clocks.whiteMs - elapsed) : clocks.whiteMs,
    blackMs: sideToMove === "black" ? Math.max(0, clocks.blackMs - elapsed) : clocks.blackMs,
  };
}
