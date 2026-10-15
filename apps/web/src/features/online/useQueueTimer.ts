import { useEffect, useState } from "react";
import { useMatchmakingStore } from "./useMatchmakingStore";

export function useQueueTimer(): string {
  const since = useMatchmakingStore((s) => s.since);
  const [formatted, setFormatted] = useState("0:00");

  useEffect(() => {
    if (since === null) {
      setFormatted("0:00");
      return;
    }
    const tick = (): void => {
      const elapsedSec = Math.floor((Date.now() - since) / 1000);
      const m = Math.floor(elapsedSec / 60);
      const s = elapsedSec % 60;
      setFormatted(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return (): void => {
      window.clearInterval(id);
    };
  }, [since]);

  return formatted;
}
