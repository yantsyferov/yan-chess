import { useState, useEffect } from "react";
import { useOnlineGameStore } from "./useOnlineGameStore";

export function useOnlineGameClock(): { whiteMs: number; blackMs: number } {
  const clocks = useOnlineGameStore((s) => s.clocks);
  const sideToMove = useOnlineGameStore((s) => s.sideToMove);
  const lastSyncClientMs = useOnlineGameStore((s) => s.lastSyncClientMs);
  const result = useOnlineGameStore((s) => s.result);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (result !== null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 100);
    return () => window.clearInterval(id);
  }, [result]);

  const elapsed = Date.now() - lastSyncClientMs;
  const w =
    sideToMove === "white" ? Math.max(0, clocks.whiteMs - elapsed) : clocks.whiteMs;
  const b =
    sideToMove === "black" ? Math.max(0, clocks.blackMs - elapsed) : clocks.blackMs;

  // Reading `tick` ensures the setState call triggers a re-render each interval.
  void tick;

  return { whiteMs: w, blackMs: b };
}
