import { useEffect, useRef } from "react";
import { useGameStore } from "./useGameStore";

export function useGameClock(): void {
  const activeSide = useGameStore((s) => s.clock.activeSide);
  const tickClock = useGameStore((s) => s.tickClock);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeSide) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
      return;
    }
    lastRef.current = performance.now();
    const loop = (now: number): void => {
      const prev = lastRef.current ?? now;
      const delta = now - prev;
      lastRef.current = now;
      tickClock(delta);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
    };
  }, [activeSide, tickClock]);

  // Catch up time while the tab was hidden.
  useEffect(() => {
    function onVisibilityChange(): void {
      if (document.visibilityState === "visible" && activeSide && lastRef.current !== null) {
        const now = performance.now();
        const elapsed = now - lastRef.current;
        lastRef.current = now;
        if (elapsed > 0) tickClock(elapsed);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [activeSide, tickClock]);
}
