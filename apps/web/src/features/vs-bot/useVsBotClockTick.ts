import { useEffect, useRef } from "react";
import { useVsBotStore } from "./useVsBotStore";

/**
 * Drives the vs-bot flag detection via a requestAnimationFrame loop.
 * Calls `tickClock()` every frame while the game is active.
 */
export function useVsBotClockTick(): void {
  const phase = useVsBotStore((s) => s.phase);
  const result = useVsBotStore((s) => s.result);
  const tickClock = useVsBotStore((s) => s.tickClock);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "playing" || result !== null) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const loop = (): void => {
      tickClock();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase, result, tickClock]);
}
