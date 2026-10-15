import { formatClock, isLowOnTime } from "../../features/game/clock-math";

interface ClockProps {
  ms: number;
  isActive: boolean;
}

export function Clock({ ms, isActive }: ClockProps): JSX.Element {
  const low = isLowOnTime(ms);

  return (
    <div
      className={`flex w-full sm:w-auto sm:inline-flex items-center justify-center px-6 py-3 rounded-xl font-mono text-3xl tabular-nums
        ${low ? "text-danger" : "text-text-primary"}
        ${isActive ? "bg-surface-elevated border-2 border-accent shadow-glow" : "bg-surface-elevated/50 border border-border-subtle"}`}
    >
      {formatClock(ms)}
    </div>
  );
}
