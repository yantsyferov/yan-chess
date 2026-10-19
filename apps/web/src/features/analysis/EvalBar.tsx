interface EvalBarProps {
  evaluationCp: number | null;
  mateIn: number | null;
  boardHeight: number;
}

function formatLabel(evaluationCp: number | null, mateIn: number | null): string {
  if (mateIn !== null) {
    return `M${Math.abs(mateIn)}`;
  }
  if (evaluationCp !== null) {
    const pawns = evaluationCp / 100;
    const sign = pawns > 0 ? "+" : "";
    return `${sign}${pawns.toFixed(1)}`;
  }
  return "0.0";
}

export function EvalBar({ evaluationCp, mateIn, boardHeight }: EvalBarProps): JSX.Element {
  const isPending = evaluationCp === null && mateIn === null;

  let whitePercent: number;
  if (mateIn !== null) {
    whitePercent = mateIn > 0 ? 100 : 0;
  } else if (evaluationCp !== null) {
    const raw = 50 + 50 * Math.tanh(evaluationCp / 400);
    whitePercent = Math.max(1, Math.min(99, raw));
  } else {
    whitePercent = 50;
  }

  const label = formatLabel(evaluationCp, mateIn);

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{ height: boardHeight }}
      aria-label={`Evaluation: ${label}`}
    >
      <span className="text-xs font-mono text-text-primary tabular-nums select-none">
        {label}
      </span>

      <div
        className="relative w-5 flex-1 rounded overflow-hidden border border-border-subtle"
        data-testid="eval-bar-track"
      >
        {isPending ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #fff 0px, #fff 4px, #1a1a1a 4px, #1a1a1a 8px)",
            }}
            data-testid="eval-bar-pending"
          />
        ) : (
          <>
            {/* White portion — top */}
            <div
              className="absolute top-0 left-0 right-0 bg-white transition-all duration-300"
              style={{ height: `${whitePercent}%` }}
              data-testid="eval-bar-white"
            />
            {/* Black portion — bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-neutral-900 transition-all duration-300"
              style={{ height: `${100 - whitePercent}%` }}
              data-testid="eval-bar-black"
            />
            {mateIn !== null && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                data-testid="eval-bar-mate-indicator"
              >
                <span className="text-[10px] font-bold leading-none select-none mix-blend-difference text-white">
                  {label}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
